import { EventInterface } from 'microevent.ts'



interface RpcProviderInterface {

  dispatch( message: any, event: MessageEvent ): void;

  rpc<T = void, U = void>( id: string, payload?: T, transfer?: Array<any>, options?: RpcProviderInterface.RpcCallOptions ): Promise<U>;

  signal<T = void>( id: string, payload?: T, transfer?: Array<any> ): this;

  registerRpcHandler<T = void, U = void>( id: string, handler: RpcProviderInterface.RpcHandler<T, U> ): this;

  registerSignalHandler<T = void>( id: string, handler: RpcProviderInterface.SignalHandler<T> ): this;

  deregisterRpcHandler<T = void, U = void>( id: string, handler: RpcProviderInterface.RpcHandler<T, U> ): this;

  deregisterSignalHandler<T = void>( id: string, handler: RpcProviderInterface.SignalHandler<T> ): this;

  error: EventInterface<Error>;

}

module RpcProviderInterface {

  export interface RpcCallOptions {
    timeout?: number
  }

  export interface RpcHandler<T = void, U = void> {
    ( payload: T, event: MessageEvent ): Promise<U> | U;
  }

  export interface SignalHandler<T = void> {
    ( payload: T, event: MessageEvent ): void;
  }

}

export default RpcProviderInterface
