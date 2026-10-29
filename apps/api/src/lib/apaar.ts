import { config } from '../config.js';
import { validateApaarMock } from './apaar.mock.js';

export interface ApaarDemographics {
  name: string;
  dob: string;
  gender: string;
}

export interface ApaarValidationResult {
  active: boolean;
  match: boolean;
  fields: {
    name: boolean;
    dob: boolean;
    gender: boolean;
  };
}

export async function validateApaar(
  apaarId: string,
  demographics: ApaarDemographics,
): Promise<ApaarValidationResult> {
  if (config.APAAR_MOCK) {
    return validateApaarMock(apaarId, demographics);
  }

  const response = await fetch(`${config.APAAR_API_URL}/v1/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.APAAR_API_KEY,
    },
    body: JSON.stringify({
      apaar_id: apaarId,
      name: demographics.name,
      date_of_birth: demographics.dob,
      gender: demographics.gender,
    }),
  });

  if (!response.ok) {
    throw new Error(`APAAR API returned ${response.status}`);
  }

  const body = (await response.json()) as {
    active: boolean;
    match: boolean;
    fields: { name: boolean; dob: boolean; gender: boolean };
  };

  return {
    active: body.active,
    match: body.match,
    fields: body.fields,
  };
}
