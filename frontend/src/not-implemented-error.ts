export class NotImplementedError extends Error {
  constructor(methodName: string, className?: string) {
    super(
      `Method '${methodName}'${
        className ? ` (in class: ${className})` : ""
      } is not implemented`
    );
    this.name = "NotImplementedError";
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}
