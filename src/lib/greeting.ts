/**
 * Il saluto in Home secondo l'ora: buongiorno dalle 8 alle 12, buon pomeriggio
 * dalle 13 alle 17, buonasera dalle 18 a mezzanotte, e di notte "Nottambulo oggi, …?".
 */
export function greeting(hour: number): { lead: string; question: boolean } {
  if (hour >= 8 && hour < 13) return { lead: "Buongiorno", question: false };
  if (hour >= 13 && hour < 18)
    return { lead: "Buon pomeriggio", question: false };
  if (hour >= 18) return { lead: "Buonasera", question: false };
  return { lead: "Nottambulo oggi", question: true };
}
