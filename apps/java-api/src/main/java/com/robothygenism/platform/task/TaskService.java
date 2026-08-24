package com.robothygenism.platform.task;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.realtime.EventStreamService;
import com.robothygenism.platform.safety.SafePolicyService;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {
  private final JdbcClient jdbc;private final TaskStateService states;private final SafePolicyService safety;private final ObjectMapper json;private final EventStreamService events;
  public TaskService(JdbcClient jdbc,TaskStateService states,SafePolicyService safety,ObjectMapper json,EventStreamService events){this.jdbc=jdbc;this.states=states;this.safety=safety;this.json=json;this.events=events;}
  @Transactional public Map<String,Object> create(CreateTask request,PlatformPrincipal actor){var robot=jdbc.sql("SELECT \"tenantId\",\"projectId\",\"floorId\",\"onlineStatus\"::text online,\"operationalState\"::text state FROM \"Robot\" WHERE id=:id AND \"lifecycleStatus\"='ACTIVE'").param("id",request.robotId()).query().listOfRows().stream().findFirst().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"ROBOT_NOT_FOUND","Robot not found"));if(!request.projectId().equals(robot.get("projectId")))throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_TASK","Robot does not belong to the project");var map=jdbc.sql("SELECT mv.id,m.\"floorId\" FROM \"MapVersion\" mv JOIN \"PlatformMap\" m ON m.id=mv.\"mapId\" WHERE mv.id=:id AND mv.status='PUBLISHED'").param("id",request.mapVersionId()).query().listOfRows().stream().findFirst().orElseThrow(()->new ApiException(HttpStatus.CONFLICT,"MAP_NOT_AVAILABLE","Published map version not found"));if(!robot.get("floorId").equals(map.get("floorId")))throw new ApiException(HttpStatus.CONFLICT,"MAP_VERSION_MISMATCH","Map is not valid for the robot floor");if(request.zoneId()!=null){boolean zoneMatches=jdbc.sql("SELECT EXISTS(SELECT 1 FROM \"Zone\" WHERE id=:zone AND \"mapVersionId\"=:version)").param("zone",request.zoneId()).param("version",request.mapVersionId()).query(Boolean.class).single();if(!zoneMatches)throw new ApiException(HttpStatus.CONFLICT,"MAP_VERSION_MISMATCH","Zone does not belong to the selected map version");}UUID id=UUID.randomUUID();String status=request.scheduledAt()==null?"DRAFT":"SCHEDULED";jdbc.sql("INSERT INTO \"Task\" (id,\"tenantId\",\"projectId\",\"robotId\",\"mapVersionId\",\"zoneId\",name,status,\"scheduledAt\",\"createdById\",\"createdAt\",\"updatedAt\") VALUES (:id,:tenant,:project,:robot,:map,:zone,:name,CAST(:status AS \"TaskStatus\"),:scheduled,:actor,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",id).param("tenant",robot.get("tenantId")).param("project",request.projectId()).param("robot",request.robotId()).param("map",request.mapVersionId()).param("zone",request.zoneId()).param("name",request.name()).param("status",status).param("scheduled",request.scheduledAt()).param("actor",actor.id()).update();event(id,null,status,"USER",null);return get(id);}
  @Transactional public Map<String,Object> command(UUID taskId,String action,String idempotencyKey,PlatformPrincipal actor){
    var task=get(taskId);UUID robotId=(UUID)task.get("robotId");String current=(String)task.get("status");
    String type=switch(action){case"start"->"MISSION_START";case"pause"->"MISSION_PAUSE";case"resume"->"MISSION_RESUME";case"cancel"->"MISSION_CANCEL";default->throw new ApiException(HttpStatus.BAD_REQUEST,"INVALID_COMMAND","Unknown task action");};
    if(idempotencyKey!=null){
      var existing=jdbc.sql("SELECT c.* FROM \"Command\" c WHERE c.\"createdById\"=:actor AND c.\"idempotencyKey\"=:key").param("actor",actor.id()).param("key",idempotencyKey).query().listOfRows().stream().findFirst();
      if(existing.isPresent()){
        requireMatchingIdempotentCommand(existing.get(),taskId,type);
        return existing.get();
      }
    }
    states.requireCommand(current,action);
    if(action.equals("start"))validateStart(robotId,task);else if(action.equals("resume"))safety.requireTaskAllowed(robotId,"RESUME");
    UUID commandId=UUID.randomUUID();Map<String,Object> commandPayload=Map.of("taskId",taskId,"mapVersionId",task.get("mapVersionId"));String payload=stringify(commandPayload);jdbc.sql("INSERT INTO \"Command\" (id,\"robotId\",\"taskId\",type,payload,status,\"idempotencyKey\",\"createdById\",\"createdAt\",\"updatedAt\") VALUES (:id,:robot,:task,CAST(:type AS \"CommandType\"),CAST(:payload AS jsonb),'CREATED',:key,:actor,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",commandId).param("robot",robotId).param("task",taskId).param("type",type).param("payload",payload).param("key",idempotencyKey).param("actor",actor.id()).update();jdbc.sql("INSERT INTO \"OutboxMessage\" (id,\"aggregateType\",\"aggregateId\",topic,payload,\"availableAt\",\"createdAt\") VALUES (:id,'Command',:aggregate,:topic,CAST(:payload AS jsonb),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").param("id",UUID.randomUUID()).param("aggregate",commandId.toString()).param("topic","robots/"+robotId+"/commands").param("payload",stringify(Map.of("schemaVersion","1.0","messageId","MSG-"+UUID.randomUUID(),"commandId",commandId,"robotId",robotId,"type",type,"timestamp",System.currentTimeMillis(),"payload",commandPayload))).update();events.publish("command.status.changed",(UUID)task.get("tenantId"),(UUID)task.get("projectId"),Map.of("taskId",taskId,"status","CREATED","commandId",commandId));return jdbc.sql("SELECT * FROM \"Command\" WHERE id=:id").param("id",commandId).query().singleRow();
  }
  static void requireMatchingIdempotentCommand(Map<String,Object> existing,UUID taskId,String type){if(!taskId.equals(existing.get("taskId"))||!type.equals(String.valueOf(existing.get("type"))))throw new ApiException(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Idempotency key was already used for another command");}
  public Map<String,Object> get(UUID id){return jdbc.sql("SELECT id,\"tenantId\",\"projectId\",\"robotId\",\"mapVersionId\",\"zoneId\",name,status::text status,\"scheduledAt\",\"currentProgress\",\"lastStatusAt\",\"createdAt\",\"updatedAt\" FROM \"Task\" WHERE id=:id").param("id",id).query().listOfRows().stream().findFirst().orElseThrow(()->new ApiException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Task not found"));}
  private void validateStart(UUID robotId,Map<String,Object> task){var robot=jdbc.sql("SELECT \"onlineStatus\"::text online,\"operationalState\"::text state,\"currentTaskId\" FROM \"Robot\" WHERE id=:id").param("id",robotId).query().singleRow();if(!"ONLINE".equals(robot.get("online")))throw new ApiException(HttpStatus.CONFLICT,"ROBOT_OFFLINE","Offline robot cannot start a task");if(!"READY".equals(robot.get("state")))throw new ApiException(HttpStatus.CONFLICT,"ROBOT_NOT_READY","Robot is not READY");if(robot.get("currentTaskId")!=null)throw new ApiException(HttpStatus.CONFLICT,"ROBOT_BUSY","Robot already has a current task");safety.requireTaskAllowed(robotId,"START");}
  private void transition(UUID id,String from,String to,String source,String reason){jdbc.sql("UPDATE \"Task\" SET status=CAST(:to AS \"TaskStatus\"),\"lastStatusSource\"=:source,\"lastStatusAt\"=CURRENT_TIMESTAMP,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:id").param("to",to).param("source",source).param("id",id).update();event(id,from,to,source,reason);}
  private void event(UUID id,String from,String to,String source,String reason){jdbc.sql("INSERT INTO \"TaskEvent\" (id,\"taskId\",\"fromStatus\",\"toStatus\",source,reason,\"receivedAt\") VALUES (:event,:task,CAST(:from AS \"TaskStatus\"),CAST(:to AS \"TaskStatus\"),:source,:reason,CURRENT_TIMESTAMP)").param("event",UUID.randomUUID()).param("task",id).param("from",from).param("to",to).param("source",source).param("reason",reason).update();}
  private String stringify(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException error){throw new IllegalStateException(error);}}
  public record CreateTask(UUID projectId,UUID robotId,UUID mapVersionId,UUID zoneId,String name,OffsetDateTime scheduledAt){}
}



