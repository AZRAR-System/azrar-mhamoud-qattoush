/**
 * © 2026 — AZRAR Tafkeet Utility
 * Converts numbers into Arabic text (JOD context).
 */

const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
const teens = ["عشر", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];


function convertThreeDigits(n: number, isThousands = false): string {
    if (n === 0) return "";
    let res = "";
    const h = Math.floor(n / 100);
    const remainder = n % 100;
    const t = Math.floor(remainder / 10);
    const u = remainder % 10;

    if (h > 0) {
        res += hundreds[h];
    }

    if (remainder > 0) {
        if (res) res += " و";
        if (remainder < 11) {
            res += units[remainder];
        } else if (remainder < 20) {
            res += teens[remainder - 10];
        } else {
            if (u > 0) res += units[u] + " و";
            res += tens[t];
        }
    }

    // Special cases for Arabic duality/plurality in thousands
    if (isThousands) {
        if (n === 1) return "ألف";
        if (n === 2) return "ألفان";
        if (n >= 3 && n <= 10) return res + " آلاف";
        return res + " ألف";
    }

    return res;
}

export function tafkeet(amount: number): string {
    if (amount === 0) return "صفر دينار أردني فقط لا غير";

    const integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);

    let res = "";

    const mill = Math.floor(integerPart / 1000000);
    const thou = Math.floor((integerPart % 1000000) / 1000);
    const rest = integerPart % 1000;

    if (mill > 0) {
        if (mill === 1) res += "مليون";
        else if (mill === 2) res += "مليونان";
        else if (mill <= 10) res += convertThreeDigits(mill) + " ملايين";
        else res += convertThreeDigits(mill) + " مليون";
    }

    if (thou > 0) {
        if (res) res += " و";
        res += convertThreeDigits(thou, true);
    }

    if (rest > 0) {
        if (res) res += " و";
        res += convertThreeDigits(rest);
    }

    res += " دينار أردني";

    if (decimalPart > 0) {
        res += " و" + convertThreeDigits(decimalPart) + " فلس";
    }

    res += " فقط لا غير";
    
    // Cleanup double spaces or weird "و" at start
    return res.replace(/\s+/g, ' ').trim();
}
