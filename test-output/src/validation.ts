import { z } from 'zod';


export class ValidationError extends Error {
  constructor(message: string, public parameter?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}






export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

export function formatValidationError(error: ValidationError): string {
  return error.parameter 
    ? `Validation failed for parameter '${error.parameter}': ${error.message}`
    : `Validation failed: ${error.message}`;
}

export function validateRequest<T>(validator: (params: any) => T, params: any): T {
  try {
    return validator(params);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
