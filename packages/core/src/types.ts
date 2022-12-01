import { IDiagnostic, Dictionary, HttpMethod } from '@stoplight/types';
import { Either } from 'fp-ts/Either';
import { ReaderEither } from 'fp-ts/ReaderEither';
import { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import { TaskEither } from 'fp-ts/TaskEither';
import { Logger } from 'pino';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';

export type IPrismDiagnostic = Omit<IDiagnostic, 'range' | 'path'> & { path?: string[] };

export interface IPrism<Resource, Input, Output, Config extends IPrismConfig> {
  request: (input: Input, resources: Resource[], config?: Config) => TaskEither<Error, IPrismOutput<Output>>;
}

export type ValidatorFn<R, E> = (opts: { resource: R; element: E }) => Either<NonEmptyArray<IPrismDiagnostic>, E>;

type IPrismBaseConfig = {
  checkSecurity: boolean;
  validateRequest: boolean;
  validateResponse: boolean;
  errors: boolean;
  upstreamProxy: string | undefined;
};

export type IPrismMockConfig = IPrismBaseConfig & {
  mock: object;
};

export type IPrismProxyConfig = IPrismBaseConfig & {
  mock: false;
  upstream: URL;
};

export type IPrismConfig = IPrismMockConfig | IPrismProxyConfig;

export type IPrismComponents<Resource, Input, Output, Config extends IPrismConfig> = {
  route: (opts: { resources: Resource[]; input: Input }) => Either<Error, Resource>;
  validateInput: ValidatorFn<Resource, Input>;
  validateSecurity: ValidatorFn<Resource, Input>;
  validateOutput: ValidatorFn<Resource, Output>;
  forward: (
    input: IPrismInput<Input>,
    baseUrl: string,
    upstreamProxy: Config['upstreamProxy'],
    resource?: Resource
  ) => ReaderTaskEither<Logger, Error, Output>;
  mock: (opts: {
    resource: Resource;
    input: IPrismInput<Input>;
    config: Config['mock'];
  }) => ReaderEither<Logger, Error, Output>;
  logger: Logger;
};

export interface IPrismInput<I> {
  data: I;
  validations: IPrismDiagnostic[];
}

export interface IPrismOutput<O> {
  output: O;
  validations: {
    input: IPrismDiagnostic[];
    output: IPrismDiagnostic[];
  };
}

export interface IHttpOperationConfig {
  mediaTypes?: string[];
  code?: number;
  exampleKey?: string;
  dynamic: boolean;
}

export type ProblemJson = {
  type: string;
  title: string;
  status: number;
  detail: string;
};
export class ProblemJsonError extends Error {
  public static fromTemplate(
    template: Omit<ProblemJson, 'detail'>,
    detail?: string,
    additional?: Dictionary<unknown>
  ): ProblemJsonError {
    return new ProblemJsonError(
      `https://stoplight.io/prism/errors#${template.type}`,
      template.title,
      template.status,
      detail || '',
      additional
    );
  }

  public static toProblemJson(
    error: Error & { detail?: string; status?: number; additional?: Dictionary<unknown> }
  ): ProblemJson {
    return {
      type: error.name && error.name !== 'Error' ? error.name : 'https://stoplight.io/prism/errors#UNKNOWN',
      title: error.message,
      status: error.status || 500,
      detail: error.detail || '',
      ...error.additional,
    };
  }

  constructor(
    readonly name: string,
    readonly message: string,
    readonly status: number,
    readonly detail: string,
    readonly additional?: Dictionary<unknown>
  ) {
    super(message);
  }
}

export const UNPROCESSABLE_ENTITY: Omit<ProblemJson, 'detail'> = {
  type: 'UNPROCESSABLE_ENTITY',
  title: 'Invalid request',
  status: 422,
};

export type IHttpNameValues = Dictionary<string | string[]>;
export type IHttpNameValue = Dictionary<string>;
export interface IHttpUrl {
  baseUrl?: string;
  path: string;
  query?: IHttpNameValues;
}

export interface IHttpRequest {
  method: HttpMethod;
  url: IHttpUrl;
  headers?: IHttpNameValue;
  body?: unknown;
}