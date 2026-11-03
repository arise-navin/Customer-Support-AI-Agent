import { describe, expect, it } from 'vitest';
import { runGovernanceScenario, runAllGovernanceScenarios } from '@signet/signet-adapter';

describe('Phase 8 — Signet Governance and Security Testing (SG-001 to SG-020)', () => {
  it('SG-001: Valid agent certificate allows request', async () => {
    const res = await runGovernanceScenario('SG-001');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('ALLOW');
  });

  it('SG-002: Missing certificate blocks request', async () => {
    const res = await runGovernanceScenario('SG-002');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('Missing agent certificate');
  });

  it('SG-003: Expired certificate blocks request', async () => {
    const res = await runGovernanceScenario('SG-003');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('expired');
  });

  it('SG-004: Revoked certificate blocks request', async () => {
    const res = await runGovernanceScenario('SG-004');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('revoked');
  });

  it('SG-005: Support Agent attempts unauthorized refund', async () => {
    const res = await runGovernanceScenario('SG-005');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('forbidden');
  });

  it('SG-006: Unauthorized model invocation', async () => {
    const res = await runGovernanceScenario('SG-006');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('not authorized');
  });

  it('SG-007: Unauthorized tool invocation', async () => {
    const res = await runGovernanceScenario('SG-007');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('forbidden');
  });

  it('SG-008: Synthetic payment card data is detected', async () => {
    const res = await runGovernanceScenario('SG-008');
    expect(res.status).toBe('PASS');
    expect(res.details).toContain('PAYMENT_CARD');
  });

  it('SG-009: Fake API token is detected', async () => {
    const res = await runGovernanceScenario('SG-009');
    expect(res.status).toBe('PASS');
    expect(res.details).toContain('API_TOKEN');
  });

  it('SG-010: Sensitive data in tool arguments is detected', async () => {
    const res = await runGovernanceScenario('SG-010');
    expect(res.status).toBe('PASS');
    expect(res.details).toContain('DLP detected in tool arguments');
  });

  it('SG-011: Sensitive data in model response is detected', async () => {
    const res = await runGovernanceScenario('SG-011');
    expect(res.status).toBe('PASS');
    expect(res.details).toContain('DLP intercepted sensitive payload');
  });

  it('SG-012: Prompt injection attempts to override policy', async () => {
    const res = await runGovernanceScenario('SG-012');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('PROMPT_INJECTION');
  });

  it('SG-013: Human approval required for restricted action', async () => {
    const res = await runGovernanceScenario('SG-013');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('REQUIRE_APPROVAL');
  });

  it('SG-014: Agent exceeds rate limit', async () => {
    const res = await runGovernanceScenario('SG-014');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('rate limit');
  });

  it('SG-015: Agent is quarantined', async () => {
    const res = await runGovernanceScenario('SG-015');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('QUARANTINE');
    expect(res.details).toContain('quarantine');
  });

  it('SG-016: Agent is killed', async () => {
    const res = await runGovernanceScenario('SG-016');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('Kill Switch');
  });

  it('SG-017: Killed agent attempts another request', async () => {
    const res = await runGovernanceScenario('SG-017');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('Kill Switch');
  });

  it('SG-018: Agent-to-agent handoff violates permissions', async () => {
    const res = await runGovernanceScenario('SG-018');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
  });

  it('SG-019: Signet Gateway becomes unavailable (fail-closed)', async () => {
    const res = await runGovernanceScenario('SG-019');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('DENY');
    expect(res.details).toContain('Fail-closed verified');
  });

  it('SG-020: Signet evidence reference is generated', async () => {
    const res = await runGovernanceScenario('SG-020');
    expect(res.status).toBe('PASS');
    expect(res.actualDecision).toBe('ALLOW');
    expect(res.evidenceRef).toMatch(/^ev-sgn-/);
  });

  it('Full Suite: All 20 scenarios execute successfully in sequence', async () => {
    const allResults = await runAllGovernanceScenarios();
    expect(allResults.length).toBe(20);
    const passed = allResults.filter((r) => r.status === 'PASS').length;
    expect(passed).toBe(20);
  });
});
