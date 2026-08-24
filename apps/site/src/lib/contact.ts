export interface Inquiry { name: string; company: string; email: string; region: string; topic: string; message: string }

export function validateInquiry(value: Inquiry) {
  const errors: Partial<Record<keyof Inquiry, string>> = {};
  if (!value.name.trim()) errors.name = 'required';
  if (!value.company.trim()) errors.company = 'required';
  if (!/^\S+@\S+\.\S+$/.test(value.email)) errors.email = 'email';
  if (!value.region.trim()) errors.region = 'required';
  if (!value.message.trim()) errors.message = 'required';
  return errors;
}

export function inquiryMailto(value: Inquiry) {
  const subject = `旦生计划咨询 — ${value.topic || 'General'}`;
  const body = [`Name: ${value.name}`, `Company: ${value.company}`, `Email: ${value.email}`, `Country / Region: ${value.region}`, `Topic: ${value.topic || 'General'}`, '', value.message].join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
