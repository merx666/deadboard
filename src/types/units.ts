export type Brand<K, T> = K & { readonly __brand: T };

export type Ohms = Brand<number, 'Ohms'>;
export type Farads = Brand<number, 'Farads'>;
export type Volts = Brand<number, 'Volts'>;
export type Amps = Brand<number, 'Amps'>;
export type Millimeters = Brand<number, 'Millimeters'>;
export type NetId = Brand<string, 'NetId'>;
export type ComponentId = Brand<string, 'ComponentId'>;

export function ohms(val: number): Ohms { return val as Ohms; }
export function farads(val: number): Farads { return val as Farads; }
export function volts(val: number): Volts { return val as Volts; }
export function amps(val: number): Amps { return val as Amps; }
export function mm(val: number): Millimeters { return val as Millimeters; }
export function netId(val: string): NetId { return val as NetId; }
export function componentId(val: string): ComponentId { return val as ComponentId; }
