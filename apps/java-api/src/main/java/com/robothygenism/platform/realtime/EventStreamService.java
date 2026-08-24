package com.robothygenism.platform.realtime;

import com.robothygenism.platform.auth.PlatformPrincipal;
import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class EventStreamService {
  private final List<Subscription> subscriptions = new CopyOnWriteArrayList<>();

  public SseEmitter subscribe(PlatformPrincipal principal) {
    var emitter = new SseEmitter(Duration.ofMinutes(30).toMillis());
    var subscription = new Subscription(emitter, principal.superAdmin(), principal.role(), principal.tenantId(), principal.projectIds());
    subscriptions.add(subscription);
    emitter.onCompletion(() -> subscriptions.remove(subscription));
    emitter.onTimeout(() -> subscriptions.remove(subscription));
    emitter.onError(error -> subscriptions.remove(subscription));
    return emitter;
  }

  public void publish(String type, UUID tenantId, UUID projectId, Object payload) {
    var event = new Event(UUID.randomUUID().toString(), type, OffsetDateTime.now(), payload);
    for (var subscription : subscriptions) {
      if (!canRead(subscription.superAdmin(), subscription.role(), subscription.tenantId(), subscription.projectIds(), tenantId, projectId)) continue;
      try {
        subscription.emitter().send(SseEmitter.event().id(event.id()).name(type).data(event));
      } catch (IOException error) {
        subscriptions.remove(subscription);
      }
    }
  }

  int subscriptionCount() { return subscriptions.size(); }

  static boolean canRead(boolean superAdmin, String role, UUID tenantId, Set<UUID> projectIds, UUID eventTenantId, UUID eventProjectId) {
    if (superAdmin) return true;
    if (tenantId == null || eventTenantId == null || !tenantId.equals(eventTenantId)) return false;
    if ("TENANT_ADMIN".equals(role)) return true;
    return eventProjectId != null && projectIds.contains(eventProjectId);
  }

  private record Subscription(SseEmitter emitter, boolean superAdmin, String role, UUID tenantId, Set<UUID> projectIds) {}

  public record Event(String id,String type,OffsetDateTime timestamp,Object payload){}
}
