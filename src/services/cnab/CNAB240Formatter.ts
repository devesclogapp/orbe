export class CNAB240Formatter {
  static sanitize(value: string): string {
    if (!value) return '';
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .toUpperCase();
  }

  static padLeftZero(value: string | number, length: number): string {
    const str = String(value).replace(/[^0-9]/g, '');
    return str.padStart(length, '0').substring(str.length > length ? str.length - length : 0, Math.max(str.length, length));
  }

  static padRightSpace(value: string, length: number): string {
    const sanitized = this.sanitize(value);
    return sanitized.padEnd(length, ' ').substring(0, length);
  }

  static formatMoney(value: number, length: number): string {
    const cents = Math.round(value * 100);
    return this.padLeftZero(cents, length);
  }

  static formatDate(date: Date | string): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '00000000';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}${month}${year}`;
  }

  static formatTime(date: Date | string): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '000000';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}${m}${s}`;
  }
}
