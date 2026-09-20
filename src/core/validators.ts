export const luhnCheck = (digits: string): boolean => {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

export const ibanCheck = (iban: string): boolean => {
  const normalized = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) return false;
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));

  // mod-97 over a huge numeric string via chunked remainder
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = String(remainder) + numeric.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }
  return remainder === 1;
};

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export const dniNieCheck = (value: string): boolean => {
  const normalized = value.replace(/[\s-]/g, '').toUpperCase();
  const dniMatch = /^(\d{8})([A-Z])$/.exec(normalized);
  const nieMatch = /^([XYZ])(\d{7})([A-Z])$/.exec(normalized);

  if (dniMatch) {
    const [, digits, letter] = dniMatch;
    return DNI_LETTERS[Number(digits) % 23] === letter;
  }

  if (nieMatch) {
    const [, prefix, digits, letter] = nieMatch;
    const prefixDigit = { X: '0', Y: '1', Z: '2' }[prefix];
    return DNI_LETTERS[Number(prefixDigit + digits) % 23] === letter;
  }

  return false;
};
