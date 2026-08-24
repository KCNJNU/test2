package com.robothygenism.platform.ota;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.robothygenism.platform.common.ApiException;
import org.junit.jupiter.api.Test;

class OtaStateMachineTest {
  private final OtaStateMachine states = new OtaStateMachine();

  @Test void allowsDocumentedForwardAndRollbackTransitions() {
    assertThat(states.canMove("PENDING", "DOWNLOADING")).isTrue();
    assertThat(states.canMove("VERIFYING", "INSTALLING")).isTrue();
    assertThat(states.canMove("FAILED", "ROLLED_BACK")).isTrue();
    assertThat(states.terminal("SUCCEEDED")).isTrue();
  }

  @Test void blocksInstallBeforeChecksumVerificationAndTerminalRegression() {
    assertThatThrownBy(() -> states.require("DOWNLOADING", "INSTALLING")).isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> states.require("SUCCEEDED", "INSTALLING")).isInstanceOf(ApiException.class);
  }
}
