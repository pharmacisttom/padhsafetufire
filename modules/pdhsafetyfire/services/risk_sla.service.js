// Configurable Risk Matrix & SLA Resolution Engine

export function calculateRisk(severity, likelihood) {
  const s = Math.max(1, Math.min(5, Number(severity) || 1));
  const l = Math.max(1, Math.min(5, Number(likelihood) || 1));
  const score = s * l;

  let level = 'LOW';
  let color = '#10B981';

  if (score >= 17) {
    level = 'CRITICAL';
    color = '#991B1B';
  } else if (score >= 10) {
    level = 'HIGH';
    color = '#EF4444';
  } else if (score >= 5) {
    level = 'MODERATE';
    color = '#F59E0B';
  }

  return { severity: s, likelihood: l, score, level, color };
}

export function calculateSlaDeadlines(riskLevel, baseDate = new Date()) {
  const start = new Date(baseDate);

  // Default SLA rules by risk level
  const slaHoursMap = {
    CRITICAL: { ack: 1, corr: 4, ver: 2 },
    HIGH: { ack: 4, corr: 24, ver: 12 },
    MODERATE: { ack: 24, corr: 168, ver: 48 }, // 7 days
    LOW: { ack: 72, corr: 720, ver: 168 }     // 30 days
  };

  const hours = slaHoursMap[riskLevel] || slaHoursMap['LOW'];

  const ackDue = new Date(start.getTime() + hours.ack * 3600 * 1000);
  const corrDue = new Date(start.getTime() + hours.corr * 3600 * 1000);
  const verDue = new Date(start.getTime() + hours.ver * 3600 * 1000);

  return {
    acknowledge_due_at: ackDue.toISOString().slice(0, 19).replace('T', ' '),
    corrective_due_at: corrDue.toISOString().slice(0, 19).replace('T', ' '),
    verification_due_at: verDue.toISOString().slice(0, 19).replace('T', ' ')
  };
}
