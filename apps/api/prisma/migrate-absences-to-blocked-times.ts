// Einmalige, idempotente Datenmigration: kopiert bestehende TherapistAbsence-
// Zeilen nach TherapistBlockedTime (grund gesetzt), damit Abwesenheiten künftig
// vom Slot-Generator und der Buchungs-Konfliktprüfung berücksichtigt werden
// (TherapistAbsence wurde dort nie abgefragt — eingetragener Urlaub verhinderte
// bisher keine neuen Patienten-Buchungen). Die TherapistAbsence-Tabelle bleibt
// unangetastet bestehen (kein Datenverlust bei Doppelausführung oder Rollback).
//
// Ausführen: pnpm --filter @revio/api seed:migrate-absences
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const absences = await prisma.therapistAbsence.findMany();
  console.log(`Gefundene TherapistAbsence-Zeilen: ${absences.length}`);

  let created = 0;
  let skipped = 0;

  for (const absence of absences) {
    // Idempotenz: eine Blockzeit mit exakt denselben Eckdaten existiert bereits
    // (z.B. aus einem vorherigen Lauf dieses Skripts) → überspringen.
    const existing = await prisma.therapistBlockedTime.findFirst({
      where: {
        therapistId: absence.therapistId,
        startsAt: absence.von,
        endsAt: absence.bis,
        grund: absence.grund,
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const label = { URLAUB: 'Urlaub', FORTBILDUNG: 'Fortbildung', KRANKHEIT: 'Krankheit', SONSTIGES: 'Sonstiges' }[absence.grund] ?? 'Abwesenheit';

    await prisma.therapistBlockedTime.create({
      data: {
        therapistId: absence.therapistId,
        startsAt: absence.von,
        endsAt: absence.bis,
        title: label,
        grund: absence.grund,
      },
    });
    created++;
  }

  console.log(`Neu angelegt: ${created}`);
  console.log(`Übersprungen (bereits vorhanden): ${skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
