import { Transform } from 'class-transformer';

export function ToBoolean() {
  return Transform(
    ({ value, obj, key }) => {
      const raw = obj?.[key] ?? value;

      if (raw === true || raw === 'true' || raw === '1' || raw === 1) {
        return true;
      }

      if (raw === false || raw === 'false' || raw === '0' || raw === 0) {
        return false;
      }

      return value;
    },
    { toClassOnly: true },
  );
}
