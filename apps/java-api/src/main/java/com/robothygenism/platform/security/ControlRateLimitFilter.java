package com.robothygenism.platform.security;

import com.robothygenism.platform.auth.PlatformPrincipal;
import com.robothygenism.platform.common.ApiException;
import com.robothygenism.platform.common.SecurityErrorWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ControlRateLimitFilter extends OncePerRequestFilter {
  private final DistributedRateLimitService limits; private final SecurityErrorWriter errors;
  public ControlRateLimitFilter(DistributedRateLimitService limits, SecurityErrorWriter errors) { this.limits=limits; this.errors=errors; }
  @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
    if (!"GET".equals(request.getMethod()) && !"HEAD".equals(request.getMethod()) && !request.getRequestURI().contains("/auth/")) {
      Object principal=SecurityContextHolder.getContext().getAuthentication()==null?null:SecurityContextHolder.getContext().getAuthentication().getPrincipal();
      if(principal instanceof PlatformPrincipal p){
        String path=request.getRequestURI(); String identity=p.id()+":"+(p.tenantId()==null?"global":p.tenantId());
        try {
          if(path.contains("/tasks")||path.contains("/commands"))limits.require("task-control",identity,30,60);
          else if(path.contains("/ota")||path.contains("/campaign"))limits.require("ota",identity,5,60);
          else if(path.contains("/config"))limits.require("config",identity,10,60);
        } catch(DistributedRateLimitService.RateLimitException error){response.setHeader("Retry-After",Integer.toString(error.retryAfter()));errors.write(request,response,429,"RATE_LIMITED","Rate limit exceeded");return;}
        catch(ApiException error){errors.write(request,response,503,error.code(),error.getMessage());return;}
      }
    }
    chain.doFilter(request,response);
  }
}
