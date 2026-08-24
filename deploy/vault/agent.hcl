pid_file = "/run/vault-agent/vault-agent.pid"
exit_after_auth = false

vault { address = "https://vault.internal:8200" }

listener "tcp" {
  address = "0.0.0.0:8201"
  tls_disable = true
  require_request_header = true
}

api_proxy { use_auto_auth_token = "force" }

auto_auth {
  method "approle" {
    mount_path = "auth/approle"
    config = {
      role_id_file_path = "/etc/vault-agent/role-id"
      secret_id_file_path = "/run/vault-agent/bootstrap/secret-id"
      remove_secret_id_file_after_reading = true
    }
  }
}

template_config { exit_on_retry_failure = true }

template {
  source = "/etc/vault-agent/templates/runtime.env.ctmpl"
  destination = "/opt/robot-platform/config/runtime.env"
  perms = "0400"
  error_on_missing_key = true
  command = "/usr/local/sbin/robot-platform-secret-refresh"
  command_timeout = "120s"
}

template {
  source = "/etc/vault-agent/templates/edge-cert.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/edge/server.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/edge-key.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/edge/server-key.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/edge-ca.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/edge/ca.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/gateway-cert.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/device-gateway/device-gateway.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/gateway-key.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/device-gateway/device-gateway-key.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/gateway-ca.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/device-gateway/ca.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/emqx-cert.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/emqx/server.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/emqx-key.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/emqx/server-key.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/emqx-ca.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/emqx/ca.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/health-cert.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/health-probe/platform-health.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/health-key.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/health-probe/platform-health-key.pem"
  perms = "0400"
  error_on_missing_key = true
}
template {
  source = "/etc/vault-agent/templates/health-ca.pem.ctmpl"
  destination = "/opt/robot-platform/secrets/tls/health-probe/ca.pem"
  perms = "0400"
  error_on_missing_key = true
}
