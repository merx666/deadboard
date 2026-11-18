import type { Ohms, Farads, Volts, Amps } from './units';
import type { Body, ComponentState, LedColor, Pad, Side, V2, Component } from '../types';

interface BaseComponent {
  id: string;
  ref: string;
  at: V2;
  rot: number;
  side: Side;
  pads: Pad[];
  pins: Record<string, string>;
  body: Body;
  state: ComponentState;
  label?: string;
  footprint?: string;
}

export interface ResistorComponent extends BaseComponent {
  kind: 'resistor';
  value: Ohms;
  rating?: number;
  tolerance?: number;
}

export interface CapacitorComponent extends BaseComponent {
  kind: 'capacitor';
  value: Farads;
  maxVoltage?: Volts;
}

export interface DiodeComponent extends BaseComponent {
  kind: 'diode';
  value: number;
  forwardDrop?: Volts;
  maxCurrent?: Amps;
}

export interface LedComponent extends BaseComponent {
  kind: 'led';
  value: number;
  color: LedColor;
  forwardDrop?: Volts;
}

export interface IcComponent extends BaseComponent {
  kind: 'ic';
  value: number;
  partNumber?: string;
}

export interface SwitchComponent extends BaseComponent {
  kind: 'switch';
  value: number;
  closed?: boolean;
}

export interface BatteryComponent extends BaseComponent {
  kind: 'battery';
  value: Volts;
  internalR?: Ohms;
}

export interface FuseComponent extends BaseComponent {
  kind: 'fuse';
  value: Amps;
}

export type TypedComponent =
  | ResistorComponent
  | CapacitorComponent
  | DiodeComponent
  | LedComponent
  | IcComponent
  | SwitchComponent
  | BatteryComponent
  | FuseComponent;

export function isResistor(c: Component | TypedComponent): c is ResistorComponent {
  return c.kind === 'resistor';
}

export function isCapacitor(c: Component | TypedComponent): c is CapacitorComponent {
  return c.kind === 'capacitor';
}

export function isLed(c: Component | TypedComponent): c is LedComponent {
  return c.kind === 'led';
}

export function isIc(c: Component | TypedComponent): c is IcComponent {
  return c.kind === 'ic';
}
