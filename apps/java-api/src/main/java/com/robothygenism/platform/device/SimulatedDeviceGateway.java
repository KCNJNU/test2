package com.robothygenism.platform.device;

import com.robothygenism.platform.config.PlatformProperties;
import com.robothygenism.platform.realtime.EventStreamService;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SimulatedDeviceGateway implements DeviceGatewayPort {
  private final JdbcClient jdbc;private final PlatformProperties properties;private final EventStreamService events;
  public SimulatedDeviceGateway(JdbcClient jdbc,PlatformProperties properties,EventStreamService events){this.jdbc=jdbc;this.properties=properties;this.events=events;}
  @Override @Scheduled(fixedDelay=500) @Transactional public void publishPending(){if(!properties.simulatorEnabled())return;var item=jdbc.sql("SELECT id,\"aggregateId\",payload FROM \"OutboxMessage\" WHERE \"publishedAt\" IS NULL AND \"availableAt\"<=CURRENT_TIMESTAMP ORDER BY \"createdAt\" FOR UPDATE SKIP LOCKED LIMIT 1").query().listOfRows().stream().findFirst();if(item.isEmpty())return;UUID outbox=(UUID)item.get().get("id"),command=UUID.fromString((String)item.get().get("aggregateId"));var row=jdbc.sql("SELECT c.id,c.\"taskId\",c.\"robotId\",c.type::text type,t.\"tenantId\",t.\"projectId\" FROM \"Command\" c LEFT JOIN \"Task\" t ON t.id=c.\"taskId\" WHERE c.id=:id").param("id",command).query().singleRow();jdbc.sql("UPDATE \"OutboxMessage\" SET \"publishedAt\"=CURRENT_TIMESTAMP,attempts=attempts+1 WHERE id=:id").param("id",outbox).update();jdbc.sql("UPDATE \"Command\" SET status='SUCCEEDED',\"sentAt\"=CURRENT_TIMESTAMP,\"acceptedAt\"=CURRENT_TIMESTAMP,\"finishedAt\"=CURRENT_TIMESTAMP,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:id").param("id",command).update();UUID task=(UUID)row.get("taskId"),robot=(UUID)row.get("robotId"),tenant=(UUID)row.get("tenantId"),project=(UUID)row.get("projectId");String type=(String)row.get("type"),state=switch(type){case"MISSION_START","MISSION_RESUME"->"RUNNING";case"MISSION_PAUSE"->"PAUSED";case"MISSION_CANCEL"->"CANCELED";default->null;};if(task!=null&&state!=null){jdbc.sql("UPDATE \"Task\" SET status=CAST(:state AS \"TaskStatus\"),\"lastStatusSource\"='ROBOT_AGENT',\"lastStatusAt\"=CURRENT_TIMESTAMP,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:id").param("state",state).param("id",task).update();String robotState=state.equals("CANCELED")?"READY":state;jdbc.sql("UPDATE \"Robot\" SET \"operationalState\"=CAST(:state AS \"RobotOperationalState\"),\"currentTaskId\"=:task,\"updatedAt\"=CURRENT_TIMESTAMP WHERE id=:robot").param("state",robotState).param("task",state.equals("CANCELED")?null:task).param("robot",robot).update();events.publish("task.status.changed",tenant,project,Map.of("taskId",task,"status",state,"commandId",command));events.publish("robot.state.changed",tenant,project,Map.of("robotId",robot,"state",robotState));}}
}


