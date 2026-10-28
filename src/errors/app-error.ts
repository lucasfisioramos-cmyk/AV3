export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 401 - requisição sem credenciais válidas. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Token de autenticação inválido ou ausente.') {
    super(message, 401);
  }
}

/** 403 - usuário autenticado, mas sem permissão para o recurso. */
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado: seu perfil não possui permissão para este recurso.') {
    super(message, 403);
  }
}
