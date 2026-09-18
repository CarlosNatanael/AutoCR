class Auditor {
    /**
     * Analyzes a CodeNote instance and returns a list of QA issues.
     * @param {CodeNote} codeNote 
     * @returns {Array} List of found errors and warnings
     */
    static auditCodeNote(codeNote) {
        const issues = [];
        
        // 1. Audit Header (Format and Description)
        const headerIssues = this.auditHeader(codeNote.getHeader());
        issues.push(...headerIssues);

        // 2. Audit Enumerations (Values and Labels)
        if (codeNote.enum && codeNote.enum.length > 0) {
            const enumIssues = this.auditEnumerations(codeNote.enum, codeNote.note);
            issues.push(...enumIssues);
        }

        return issues;
    }

    static auditHeader(headerText) {
        const issues = [];
        const header = headerText.trim();

        const leftMatch = header.match(/^\[(.+?)\]\s*(.*)$/);
        const rightMatch = header.match(/^(.*?)\s*\[(.+?)\]\s*$/);

        let description = "";
        let hasValidSize = false;

        if (leftMatch) {
            hasValidSize = true;
            description = leftMatch[2].trim();
        } else if (rightMatch && rightMatch[1].trim().length > 0) {
            hasValidSize = true;
            description = rightMatch[1].trim();
        }

        if (!hasValidSize) {
            issues.push({
                level: "ERROR",
                rule: "SIZE_FORMAT_ERROR",
                message: "Code notes must have size information."
            });
            return issues; 
        }

        if (description.length <= 3 || (/^[\w]+$/.test(description) && description.toLowerCase() === "test")) {
            issues.push({
                level: "WARNING",
                rule: "VAGUE_DESCRIPTION",
                message: `The description "${description}" is too vague. Please clearly document what the address represents.`
            });
        }

        return issues;
    }

    static auditEnumerations(enumerations, fullNoteText) {
        const issues = [];
        // Checks if the developer explicitly mentioned decimal values in the note body
        const isDecimalNoted = fullNoteText.toLowerCase().includes("decimal");

        for (const enumItem of enumerations) {
            const literal = enumItem.literal.trim();
            
            // Rule 3: Always prefix hexadecimal values with 0x
            // If it doesn't start with 0x and is not a float...
            if (!literal.toLowerCase().startsWith('0x') && !literal.includes('.')) {
                
                // If it contains letters a-f, it's definitely hex without 0x.
                // Or if it's just numbers but the author didn't state it's decimal.
                const containsHexChars = /[a-f]/i.test(literal);
                if (containsHexChars || !isDecimalNoted) {
                    issues.push({
                        level: "WARNING",
                        rule: "HEX_PREFIX_MISSING",
                        message: `The value "${literal}" should be prefixed with '0x' if it is hexadecimal, or the note should specify that values are in decimal.` //[cite: 2]
                    });
                }
            }
        }
        return issues;
    }
}