/**
 * 常用库的内置类型定义
 * 这些类型定义作为本地加载和 CDN 加载都失败时的回退
 */

// Lodash 类型定义
export const lodashTypes = `
  // Array
  export function chunk<T>(array: T[], size?: number): T[][];
  export function compact<T>(array: (T | null | undefined | false | '' | 0)[]): T[];
  export function concat<T>(...arrays: (T | T[])[]): T[];
  export function difference<T>(array: T[], ...values: T[][]): T[];
  export function drop<T>(array: T[], n?: number): T[];
  export function dropRight<T>(array: T[], n?: number): T[];
  export function fill<T>(array: T[], value: T, start?: number, end?: number): T[];
  export function findIndex<T>(array: T[], predicate: (value: T) => boolean): number;
  export function flatten<T>(array: (T | T[])[]): T[];
  export function flattenDeep<T>(array: any[]): T[];
  export function head<T>(array: T[]): T | undefined;
  export function first<T>(array: T[]): T | undefined;
  export function last<T>(array: T[]): T | undefined;
  export function indexOf<T>(array: T[], value: T, fromIndex?: number): number;
  export function intersection<T>(...arrays: T[][]): T[];
  export function join(array: any[], separator?: string): string;
  export function nth<T>(array: T[], n?: number): T | undefined;
  export function pull<T>(array: T[], ...values: T[]): T[];
  export function remove<T>(array: T[], predicate: (value: T) => boolean): T[];
  export function reverse<T>(array: T[]): T[];
  export function slice<T>(array: T[], start?: number, end?: number): T[];
  export function tail<T>(array: T[]): T[];
  export function take<T>(array: T[], n?: number): T[];
  export function takeRight<T>(array: T[], n?: number): T[];
  export function union<T>(...arrays: T[][]): T[];
  export function uniq<T>(array: T[]): T[];
  export function uniqBy<T>(array: T[], iteratee: string | ((value: T) => any)): T[];
  export function without<T>(array: T[], ...values: T[]): T[];
  export function zip<T, U>(array1: T[], array2: U[]): [T, U][];
  
  // Collection
  export function countBy<T>(collection: T[], iteratee?: string | ((value: T) => any)): { [key: string]: number };
  export function every<T>(collection: T[], predicate?: (value: T) => boolean): boolean;
  export function filter<T>(collection: T[], predicate: (value: T) => boolean): T[];
  export function find<T>(collection: T[], predicate: (value: T) => boolean): T | undefined;
  export function findLast<T>(collection: T[], predicate: (value: T) => boolean): T | undefined;
  export function forEach<T>(collection: T[], iteratee: (value: T) => void): T[];
  export function groupBy<T>(collection: T[], iteratee: string | ((value: T) => string)): { [key: string]: T[] };
  export function includes<T>(collection: T[], value: T, fromIndex?: number): boolean;
  export function keyBy<T>(collection: T[], iteratee: string | ((value: T) => string)): { [key: string]: T };
  export function map<T, R>(collection: T[], iteratee: (value: T) => R): R[];
  export function orderBy<T>(collection: T[], iteratees: string[], orders?: ('asc' | 'desc')[]): T[];
  export function reduce<T, R>(collection: T[], iteratee: (acc: R, value: T) => R, initial: R): R;
  export function reject<T>(collection: T[], predicate: (value: T) => boolean): T[];
  export function sample<T>(collection: T[]): T | undefined;
  export function sampleSize<T>(collection: T[], n?: number): T[];
  export function shuffle<T>(collection: T[]): T[];
  export function size(collection: any): number;
  export function some<T>(collection: T[], predicate: (value: T) => boolean): boolean;
  export function sortBy<T>(collection: T[], iteratees: string | ((value: T) => any)): T[];
  
  // Object
  export function assign<T, U>(object: T, source: U): T & U;
  export function defaults<T, U>(object: T, source: U): T & U;
  export function get(object: any, path: string | string[], defaultValue?: any): any;
  export function has(object: any, path: string | string[]): boolean;
  export function keys(object: any): string[];
  export function values<T>(object: { [key: string]: T }): T[];
  export function entries<T>(object: { [key: string]: T }): [string, T][];
  export function merge<T, U>(object: T, source: U): T & U;
  export function omit<T extends object, K extends keyof T>(object: T, ...paths: K[]): Omit<T, K>;
  export function pick<T extends object, K extends keyof T>(object: T, ...paths: K[]): Pick<T, K>;
  export function set(object: any, path: string | string[], value: any): any;
  export function mapKeys<T>(object: { [key: string]: T }, iteratee: (value: T, key: string) => string): { [key: string]: T };
  export function mapValues<T, R>(object: { [key: string]: T }, iteratee: (value: T) => R): { [key: string]: R };
  
  // String
  export function camelCase(str: string): string;
  export function capitalize(str: string): string;
  export function kebabCase(str: string): string;
  export function lowerCase(str: string): string;
  export function snakeCase(str: string): string;
  export function startCase(str: string): string;
  export function upperCase(str: string): string;
  export function upperFirst(str: string): string;
  export function lowerFirst(str: string): string;
  export function trim(str: string, chars?: string): string;
  export function trimStart(str: string, chars?: string): string;
  export function trimEnd(str: string, chars?: string): string;
  export function pad(str: string, length?: number, chars?: string): string;
  export function padStart(str: string, length?: number, chars?: string): string;
  export function padEnd(str: string, length?: number, chars?: string): string;
  export function repeat(str: string, n?: number): string;
  export function replace(str: string, pattern: string | RegExp, replacement: string): string;
  export function split(str: string, separator?: string | RegExp, limit?: number): string[];
  
  // Function
  export function debounce<T extends (...args: any[]) => any>(func: T, wait?: number): T;
  export function throttle<T extends (...args: any[]) => any>(func: T, wait?: number): T;
  export function once<T extends (...args: any[]) => any>(func: T): T;
  export function memoize<T extends (...args: any[]) => any>(func: T): T;
  export function delay(func: (...args: any[]) => any, wait: number, ...args: any[]): number;
  
  // Util
  export function cloneDeep<T>(value: T): T;
  export function clone<T>(value: T): T;
  export function isEqual(value: any, other: any): boolean;
  export function isEmpty(value: any): boolean;
  export function isNil(value: any): value is null | undefined;
  export function isNull(value: any): value is null;
  export function isUndefined(value: any): value is undefined;
  export function isArray(value: any): value is any[];
  export function isObject(value: any): value is object;
  export function isString(value: any): value is string;
  export function isNumber(value: any): value is number;
  export function isBoolean(value: any): value is boolean;
  export function isFunction(value: any): value is (...args: any[]) => any;
  export function isDate(value: any): value is Date;
  export function isNaN(value: any): boolean;
  export function range(start: number, end?: number, step?: number): number[];
  export function random(lower?: number, upper?: number, floating?: boolean): number;
  export function uniqueId(prefix?: string): string;
  export function times<T>(n: number, iteratee: (index: number) => T): T[];
  export function noop(): void;
  export function identity<T>(value: T): T;
`

// Vue 类型定义
export const vueTypes = `
  export interface Ref<T = any> {
    value: T;
  }
  export interface ComputedRef<T = any> extends Ref<T> {
    readonly value: T;
  }
  export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);
  export type WatchCallback<V = any, OV = any> = (value: V, oldValue: OV, onCleanup: (cleanupFn: () => void) => void) => any;
  
  export function ref<T>(value: T): Ref<T>;
  export function computed<T>(getter: () => T): ComputedRef<T>;
  export function watch<T>(source: WatchSource<T>, callback: WatchCallback<T>, options?: any): void;
  export function onMounted(cb: Function): void;
  export function onUnmounted(cb: Function): void;
  export function defineComponent(options: any): any;
  export function reactive<T extends object>(target: T): T;
  export function nextTick(fn?: () => void): Promise<void>;
  export const version: string;
`

// React 类型定义
export const reactTypes = `
  export = React;
  export as namespace React;

  declare namespace React {
    type ReactNode = 
      | ReactElement
      | string
      | number
      | boolean
      | null
      | undefined
      | Iterable<ReactNode>;

    interface ReactElement<P = any> {
      type: any;
      props: P;
      key: string | null;
    }

    type ComponentType<P = {}> = ComponentClass<P> | FunctionComponent<P>;
    type FC<P = {}> = FunctionComponent<P>;
    
    interface FunctionComponent<P = {}> {
      (props: P): ReactNode;
      displayName?: string;
    }

    interface ComponentClass<P = {}, S = any> {
      new (props: P): Component<P, S>;
      defaultProps?: Partial<P>;
      displayName?: string;
    }

    class Component<P = {}, S = {}, SS = any> {
      constructor(props: P);
      readonly props: Readonly<P>;
      state: Readonly<S>;
      setState<K extends keyof S>(
        state: ((prevState: Readonly<S>, props: Readonly<P>) => Pick<S, K> | S | null) | (Pick<S, K> | S | null),
        callback?: () => void
      ): void;
      forceUpdate(callback?: () => void): void;
      render(): ReactNode;
      componentDidMount?(): void;
      componentWillUnmount?(): void;
      componentDidUpdate?(prevProps: Readonly<P>, prevState: Readonly<S>, snapshot?: SS): void;
      shouldComponentUpdate?(nextProps: Readonly<P>, nextState: Readonly<S>): boolean;
    }

    class PureComponent<P = {}, S = {}, SS = any> extends Component<P, S, SS> {}

    function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
    function useState<S = undefined>(): [S | undefined, Dispatch<SetStateAction<S | undefined>>];
    
    type Dispatch<A> = (value: A) => void;
    type SetStateAction<S> = S | ((prevState: S) => S);

    function useEffect(effect: EffectCallback, deps?: DependencyList): void;
    function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
    
    type EffectCallback = () => void | (() => void);
    type DependencyList = readonly unknown[];

    function useContext<T>(context: Context<T>): T;
    
    function useReducer<R extends Reducer<any, any>, I>(
      reducer: R,
      initializerArg: I,
      initializer: (arg: I) => ReducerState<R>
    ): [ReducerState<R>, Dispatch<ReducerAction<R>>];
    function useReducer<R extends Reducer<any, any>>(
      reducer: R,
      initialState: ReducerState<R>
    ): [ReducerState<R>, Dispatch<ReducerAction<R>>];
    
    type Reducer<S, A> = (prevState: S, action: A) => S;
    type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
    type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;

    function useCallback<T extends (...args: any[]) => any>(callback: T, deps: DependencyList): T;
    function useMemo<T>(factory: () => T, deps: DependencyList): T;
    
    function useRef<T>(initialValue: T): MutableRefObject<T>;
    function useRef<T>(initialValue: T | null): RefObject<T>;
    function useRef<T = undefined>(): MutableRefObject<T | undefined>;
    
    interface RefObject<T> {
      readonly current: T | null;
    }
    interface MutableRefObject<T> {
      current: T;
    }

    function useImperativeHandle<T, R extends T>(ref: Ref<T> | undefined, init: () => R, deps?: DependencyList): void;
    function useDebugValue<T>(value: T, format?: (value: T) => any): void;
    
    interface Context<T> {
      Provider: any;
      Consumer: any;
      displayName?: string;
    }
    function createContext<T>(defaultValue: T): Context<T>;

    function createElement<P extends {}>(
      type: string | ComponentType<P>,
      props?: P | null,
      ...children: ReactNode[]
    ): ReactElement<P>;

    function cloneElement<P>(
      element: ReactElement<P>,
      props?: Partial<P> | null,
      ...children: ReactNode[]
    ): ReactElement<P>;

    function isValidElement<P>(object: {} | null | undefined): object is ReactElement<P>;
    const Children: any;

    const Fragment: any;
    const StrictMode: any;
    const Suspense: any;
    const Profiler: any;

    function memo<P extends object>(
      Component: FunctionComponent<P>,
      propsAreEqual?: (prevProps: Readonly<P>, nextProps: Readonly<P>) => boolean
    ): any;
    function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): any;

    function startTransition(callback: () => void): void;

    type PropsWithChildren<P = unknown> = P & { children?: ReactNode };

    interface SyntheticEvent<T = Element, E = Event> {
      bubbles: boolean;
      cancelable: boolean;
      currentTarget: EventTarget & T;
      defaultPrevented: boolean;
      eventPhase: number;
      isTrusted: boolean;
      nativeEvent: E;
      preventDefault(): void;
      stopPropagation(): void;
      target: EventTarget;
      timeStamp: number;
      type: string;
    }
    interface MouseEvent<T = Element> extends SyntheticEvent<T> {
      altKey: boolean;
      button: number;
      buttons: number;
      clientX: number;
      clientY: number;
      ctrlKey: boolean;
      metaKey: boolean;
      pageX: number;
      pageY: number;
      shiftKey: boolean;
    }
    interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
      altKey: boolean;
      charCode: number;
      ctrlKey: boolean;
      key: string;
      keyCode: number;
      metaKey: boolean;
      shiftKey: boolean;
      which: number;
      getModifierState(keyArg: string): boolean;
    }
    interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
      target: EventTarget & T;
    }
    interface FormEvent<T = Element> extends SyntheticEvent<T> {}
    interface FocusEvent<T = Element> extends SyntheticEvent<T> {
      relatedTarget: EventTarget | null;
    }

    interface CSSProperties {
      [key: string]: string | number | undefined;
    }

    const version: string;
  }
`

// Dayjs 类型定义
export const dayjsTypes = `
  interface Dayjs {
    format(template?: string): string;
    valueOf(): number;
    unix(): number;
    toDate(): Date;
    toJSON(): string;
    toISOString(): string;
    toString(): string;
    isValid(): boolean;
    year(): number;
    year(value: number): Dayjs;
    month(): number;
    month(value: number): Dayjs;
    date(): number;
    date(value: number): Dayjs;
    day(): number;
    day(value: number): Dayjs;
    hour(): number;
    hour(value: number): Dayjs;
    minute(): number;
    minute(value: number): Dayjs;
    second(): number;
    second(value: number): Dayjs;
    millisecond(): number;
    millisecond(value: number): Dayjs;
    add(value: number, unit: string): Dayjs;
    subtract(value: number, unit: string): Dayjs;
    startOf(unit: string): Dayjs;
    endOf(unit: string): Dayjs;
    isBefore(date: string | number | Date | Dayjs, unit?: string): boolean;
    isAfter(date: string | number | Date | Dayjs, unit?: string): boolean;
    isSame(date: string | number | Date | Dayjs, unit?: string): boolean;
    diff(date: string | number | Date | Dayjs, unit?: string, float?: boolean): number;
    daysInMonth(): number;
    clone(): Dayjs;
    locale(locale: string): Dayjs;
  }
  
  declare function dayjs(date?: string | number | Date | Dayjs | null): Dayjs;
  declare namespace dayjs {
    function extend(plugin: any): void;
    function locale(locale: string): void;
    function isDayjs(value: any): value is Dayjs;
    function unix(timestamp: number): Dayjs;
  }
  
  export = dayjs;
`

// UUID 类型定义
export const uuidTypes = `
  export function v1(options?: any): string;
  export function v3(name: string, namespace: string): string;
  export function v4(options?: any): string;
  export function v5(name: string, namespace: string): string;
  export function parse(uuid: string): Uint8Array;
  export function stringify(arr: Uint8Array): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
  export const NIL: string;
`

// Axios 类型定义
export const axiosTypes = `
  interface AxiosRequestConfig<D = any> {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: Record<string, string>;
    params?: any;
    data?: D;
    timeout?: number;
    responseType?: 'arraybuffer' | 'blob' | 'document' | 'json' | 'text' | 'stream';
    validateStatus?: (status: number) => boolean;
  }
  
  interface AxiosResponse<T = any, D = any> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: AxiosRequestConfig<D>;
  }
  
  interface AxiosError<T = any> extends Error {
    config: AxiosRequestConfig;
    code?: string;
    request?: any;
    response?: AxiosResponse<T>;
    isAxiosError: boolean;
  }
  
  interface AxiosInstance {
    <T = any, R = AxiosResponse<T>, D = any>(config: AxiosRequestConfig<D>): Promise<R>;
    <T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
    get<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
    delete<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
    head<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
    options<T = any, R = AxiosResponse<T>, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
    post<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
    put<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
    patch<T = any, R = AxiosResponse<T>, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
    defaults: AxiosRequestConfig;
    interceptors: {
      request: any;
      response: any;
    };
  }
  
  const axios: AxiosInstance & {
    create(config?: AxiosRequestConfig): AxiosInstance;
    isAxiosError(payload: any): payload is AxiosError;
    all<T>(values: (T | Promise<T>)[]): Promise<T[]>;
    spread<T, R>(callback: (...args: T[]) => R): (array: T[]) => R;
  };
  
  export default axios;
  export { AxiosRequestConfig, AxiosResponse, AxiosError, AxiosInstance };
`

// Express 类型定义
export const expressTypes = `
  import * as http from 'http';
  
  namespace e {
    interface Request {
      body: any;
      params: any;
      query: any;
      headers: any;
      path: string;
      method: string;
      url: string;
      cookies: any;
      session: any;
      ip: string;
      get(name: string): string | undefined;
    }
    interface Response {
      send(body: any): this;
      json(body: any): this;
      status(code: number): this;
      sendStatus(code: number): this;
      write(content: string): boolean;
      end(): void;
      redirect(url: string): void;
      redirect(status: number, url: string): void;
      render(view: string, options?: object, callback?: (err: Error, html: string) => void): void;
      set(field: string, value?: string): this;
      cookie(name: string, val: string, options?: any): this;
      clearCookie(name: string, options?: any): this;
      download(path: string, filename?: string, callback?: (err: Error) => void): void;
      sendFile(path: string, options?: any, callback?: (err: Error) => void): void;
      type(type: string): this;
      format(obj: any): this;
      attachment(filename?: string): this;
      append(field: string, value?: string | string[]): this;
      headersSent: boolean;
      locals: any;
    }
    interface NextFunction {
      (err?: any): void;
    }
    
    interface Express extends Application {
      (): Application;
      static: (root: string, options?: any) => any;
      Router: () => Router;
      json: (options?: any) => any;
      urlencoded: (options?: any) => any;
      raw: (options?: any) => any;
      text: (options?: any) => any;
    }

    interface Router {
      get(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      post(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      put(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      delete(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      patch(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      use(path: string, ...handlers: any[]): this;
      use(...handlers: any[]): this;
    }

    interface Application {
      (req: any, res: any, next?: any): any;
      listen(port: number, callback?: () => void): http.Server;
      listen(port: number, hostname: string, callback?: () => void): http.Server;
      get(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      post(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      put(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      delete(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      patch(path: string, ...handlers: ((req: Request, res: Response, next: NextFunction) => void)[]): this;
      use(path: string, ...handlers: any[]): this;
      use(...handlers: any[]): this;
      set(setting: string, val: any): this;
      get(name: string): any;
      enable(setting: string): this;
      disable(setting: string): this;
      enabled(setting: string): boolean;
      disabled(setting: string): boolean;
      engine(ext: string, fn: (path: string, options: object, callback: (e: any, rendered?: string) => void) => void): this;
      locals: any;
      route(path: string): any;
    }
  }
  
  const express: e.Express;
  export = express;
`

// Node.js 类型定义 (简化版)
export const nodeTypes = `
declare var process: {
  env: Record<string, string>;
  cwd(): string;
  platform: string;
  arch: string;
  version: string;
  versions: Record<string, string>;
};

declare var __dirname: string;
declare var __filename: string;

// Module
declare var module: {
  exports: any;
  require(id: string): any;
  id: string;
  filename: string;
  loaded: boolean;
  parent: any;
  children: any[];
};

declare var exports: any;

// Require
interface NodeRequireFunction {
  (id: string): any;
}

interface NodeRequire extends NodeRequireFunction {
  resolve(id: string): string;
  cache: any;
  extensions: any;
  main: any;
}

declare var require: NodeRequire;

declare var global: any;
declare var console: Console;
`

// 收集所有内置类型定义
export const BUILTIN_TYPES: Record<string, string> = {
  lodash: lodashTypes,
  vue: vueTypes,
  react: reactTypes,
  dayjs: dayjsTypes,
  uuid: uuidTypes,
  axios: axiosTypes,
  express: expressTypes,
  '@types/node': nodeTypes, // 添加 node 类型
  node: nodeTypes           // 别名
}
