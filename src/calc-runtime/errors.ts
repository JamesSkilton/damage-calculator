export type CalcRuntimeErrorCode =
  | 'UNKNOWN_GENERATION'
  | 'UNKNOWN_MOVE'
  | 'UNKNOWN_SPECIES'
  | 'UNSUPPORTED_MECHANIC';

export class CalcRuntimeError extends Error {
  readonly code: CalcRuntimeErrorCode;

  constructor(code: CalcRuntimeErrorCode, message: string) {
    super(message);
    this.name = 'CalcRuntimeError';
    this.code = code;
  }
}
