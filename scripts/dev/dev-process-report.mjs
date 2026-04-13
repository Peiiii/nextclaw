function pad(value, width) {
  const text = String(value ?? "-");
  return text.length >= width ? text : `${text}${" ".repeat(width - text.length)}`;
}

function formatNotes(notes) {
  return notes.length > 0 ? notes.join(",") : "-";
}

function printTableHeader() {
  console.log(
    [
      pad("status", 8),
      pad("mode", 16),
      pad("pid", 7),
      pad("pgid", 7),
      pad("ui", 7),
      pad("web", 7),
      pad("tty", 9),
      pad("age", 10),
      pad("home", 9),
      "notes"
    ].join(" ")
  );
}

function printSummaryRow(entry) {
  console.log(
    [
      pad(entry.status, 8),
      pad(entry.mode, 16),
      pad(entry.rootPid, 7),
      pad(entry.pgid, 7),
      pad(entry.uiPort ?? "-", 7),
      pad(entry.frontendPort ?? "-", 7),
      pad(entry.tty, 9),
      pad(entry.age, 10),
      pad(entry.homeScope, 9),
      formatNotes(entry.notes)
    ].join(" ")
  );
}

export function printKillSummary(result, options = {}) {
  const verbose = options.verbose === true;

  console.log("Dev Process Kill");
  console.log(`- targeted groups: ${result.targetedGroups}`);
  console.log(`- targeted pgids: ${result.targetedPgids.length}`);
  console.log(`- remaining after SIGTERM: ${result.remainingAfterTerm.length}`);
  console.log(`- remaining after SIGKILL: ${result.remainingAfterKill.length}`);
  console.log("");

  printTableHeader();
  for (const entry of result.targetedSummaries) {
    printSummaryRow(entry);
  }

  if (!verbose) {
    return;
  }

  console.log("");
  console.log("Signal Details");
  console.log(`- signaled pgids: ${result.targetedPgids.join(",") || "-"}`);
  console.log(`- survived SIGTERM: ${result.remainingAfterTerm.join(",") || "-"}`);
  console.log(`- survived SIGKILL: ${result.remainingAfterKill.join(",") || "-"}`);
}

export function printHumanSummary(summaries, options = {}) {
  const verbose = options.verbose === true;
  const total = summaries.length;
  const devStartCount = summaries.filter((entry) => entry.mode === "dev-start").length;
  const standaloneCount = total - devStartCount;
  const defaultHomeCount = summaries.filter((entry) => entry.homeScope === "default").length;

  console.log("Dev Process Status");
  console.log(`- groups: ${total}`);
  console.log(`- dev-start: ${devStartCount}`);
  console.log(`- standalone-serve: ${standaloneCount}`);
  console.log(`- default-home groups: ${defaultHomeCount}`);
  console.log("");

  printTableHeader();
  for (const entry of summaries) {
    printSummaryRow(entry);
  }

  if (!verbose) {
    return;
  }

  console.log("");
  console.log("Details");
  for (const entry of summaries) {
    console.log(`- PID ${entry.rootPid} | PGID ${entry.pgid} | ${entry.mode} | ${entry.status}`);
    console.log(`  tty=${entry.tty} age=${entry.age} ui=${entry.uiPort ?? "-"} web=${entry.frontendPort ?? "-"}`);
    console.log(`  home=${entry.homeScope} listeners=${entry.listeningPorts.join(",") || "-"}`);
    for (const process of entry.processes) {
      const roles = process.roles.join(",");
      console.log(`  pid=${process.pid} ppid=${process.ppid} roles=${roles || "-"} stat=${process.stat} etime=${process.etime}`);
      console.log(`  cmd=${process.command}`);
    }
  }
}
