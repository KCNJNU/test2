import { MockRobotAgent, MockScenario } from './device-gateway/mock-robot-agent';

const brokerUri = required('MQTT_BROKER_URI');
const robotId = required('MOCK_ROBOT_ID');
const scenario = (process.env.MOCK_ROBOT_SCENARIO ?? 'READY') as MockScenario;
const allowed: MockScenario[] = [
  'ONLINE', 'OFFLINE', 'READY', 'RUNNING', 'PAUSED', 'BLOCKED', 'SAFE-101', 'SAFE-106', 'SAFE-202', 'SAFE-301',
  'ACK_ACCEPT', 'ACK_REJECT', 'TIMEOUT', 'MAP_VERSION_MISMATCH', 'RECONNECT', 'OUT_OF_ORDER', 'DUPLICATE_EVENT',
  'OTA_SUCCESS', 'OTA_CHECKSUM_FAILURE', 'OTA_BOOT_FAILURE',
];
if (!allowed.includes(scenario)) throw new Error('MOCK_ROBOT_SCENARIO is not supported');
const agent = new MockRobotAgent(brokerUri, robotId, required('MOCK_ROBOT_SN'), scenario);
void agent.start();
const stop = () => void agent.stop();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is required`);
  return value;
}
