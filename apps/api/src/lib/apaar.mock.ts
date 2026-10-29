import type { ApaarDemographics, ApaarValidationResult } from './apaar.js';

export async function validateApaarMock(
  apaarId: string,
  _demographics: ApaarDemographics,
): Promise<ApaarValidationResult> {
  if (!/^\d{12}$/.test(apaarId)) {
    throw new Error('Invalid APAAR ID format');
  }

  if (apaarId.startsWith('000')) {
    return {
      active: false,
      match: false,
      fields: { name: false, dob: false, gender: false },
    };
  }

  if (apaarId.startsWith('111')) {
    return {
      active: true,
      match: false,
      fields: { name: false, dob: true, gender: true },
    };
  }

  return {
    active: true,
    match: true,
    fields: { name: true, dob: true, gender: true },
  };
}
