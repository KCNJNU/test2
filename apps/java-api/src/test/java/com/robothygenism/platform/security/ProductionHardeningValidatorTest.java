package com.robothygenism.platform.security;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;

class ProductionHardeningValidatorTest {
  @Test void developmentDoesNotRequireProductionSecrets(){assertDoesNotThrow(()->new ProductionHardeningValidator("DEV","mqtt://localhost","development-only",""," ").run(null));}
  @Test void productionRejectsPlaintextOrPlaceholderConfiguration(){assertThrows(IllegalStateException.class,()->new ProductionHardeningValidator("PRODUCTION","mqtt://broker","replace-me","replace-me","http://vault-agent:8201").run(null));}
  @Test void productionAcceptsTlsAndVaultRenderedValues(){assertDoesNotThrow(()->new ProductionHardeningValidator("PRODUCTION","mqtts://broker:8883","random-salt","evidence-token","http://vault-agent:8201").run(null));}
}
