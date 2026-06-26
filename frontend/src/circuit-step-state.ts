enum CircuitStepStateType {
  Idle = "idle",
  Hover = "hover",
  Active = "active",
}

export class CircuitStepState {
  private _state: CircuitStepStateType = CircuitStepStateType.Idle;

  get state(): CircuitStepStateType {
    return this._state;
  }

  setIdle() {
    this._state = CircuitStepStateType.Idle;
  }

  setHover() {
    this._state = CircuitStepStateType.Hover;
  }

  setActive() {
    this._state = CircuitStepStateType.Active;
  }

  isIdle(): boolean {
    return this._state === CircuitStepStateType.Idle;
  }

  isHover(): boolean {
    return this._state === CircuitStepStateType.Hover;
  }

  isActive(): boolean {
    return this._state === CircuitStepStateType.Active;
  }
}
