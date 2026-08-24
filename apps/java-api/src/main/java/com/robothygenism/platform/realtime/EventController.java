package com.robothygenism.platform.realtime;

import com.robothygenism.platform.auth.PlatformPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController @RequestMapping("/api/v1/events")
public class EventController {
  private final EventStreamService events;
  public EventController(EventStreamService events){this.events=events;}
  @GetMapping(value="/stream",produces="text/event-stream")
  public SseEmitter stream(Authentication authentication){return events.subscribe((PlatformPrincipal)authentication.getPrincipal());}
}
