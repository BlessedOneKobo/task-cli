import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

interface ITask {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

type TCommand = "add" | "update" | "mark-in-progress" | "mark-done" | "list";

const database = new DatabaseSync(":memory:");
database.exec(/* sql */ `
  CREATE TABLE tasks(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description VARCHAR(140) NOT NULL,
    status VARCHAR(10) DEFAULT('todo'),
    createdAt TEXT DEFAULT(CURRENT_TIMESTAMP),
    updatedAt TEXT DEFAULT(CURRENT_TIMESTAMP)
  )
`);
const load = database.prepare(
  /* sql */ `INSERT INTO tasks (id, description, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`,
);
const insert = database.prepare(
  /* sql */ `INSERT INTO tasks (description) VALUES (?)`,
);
const query = database.prepare(
  /* sql */ `SELECT * FROM tasks ORDER BY createdAt`,
);
const queryFiltered = database.prepare(
  /* sql */ `SELECT * FROM tasks WHERE status = ? ORDER BY createdAt`,
);
const updateDescription = database.prepare(
  /* sql */ `UPDATE tasks SET description = ?, updatedAt = ? WHERE id = ?`,
);
const updateStatus = database.prepare(
  /* sql */ `UPDATE tasks SET status = ?, updatedAt = ? WHERE id = ?`,
);

try {
  const content = fs.readFileSync("./db.json").toString();
  const tasks = JSON.parse(content);
  tasks.forEach(({ id, description, status, createdAt, updatedAt }: ITask) =>
    load.run(id, description, status, createdAt, updatedAt),
  );
} catch (err: any) {
  fs.writeFileSync("./db.json", "");
}

const processedArgs = getProcessArgs(process.argv);
const command = processedArgs.at(0) as TCommand;
const args = processedArgs.slice(1);

switch (command) {
  case "add": {
    const description = args.at(0);
    if (typeof description !== "string") {
      console.error("node task-cli.js add <description>");
      break;
    }
    insert.run(description);
    break;
  }
  case "update": {
    let [id, description] = args;

    description = description?.trim();
    if (description.length === 0) {
      console.error("<description> cannot be empty");
      break;
    }

    updateDescription.run(description, toTimestamp(new Date()), parseId(id));
    break;
  }
  case "mark-in-progress": {
    updateStatus.run(
      "in-progress",
      toTimestamp(new Date()),
      parseId(args.at(0)),
    );
    break;
  }
  case "mark-done": {
    updateStatus.run("done", toTimestamp(new Date()), parseId(args.at(0)));
    break;
  }
  case "list": {
    const key = args.at(0);
    if (typeof key === "string") {
      console.table(queryFiltered.all(key));
    } else {
      console.table(query.all());
    }
    break;
  }
  default: {
    console.error(`Invalid command: ${command}`);
    break;
  }
}

fs.writeFileSync("./db.json", JSON.stringify(query.all()));

function getProcessArgs(processArgs: string[]): string[] {
  // script was run with "node task-cli.js [args]"
  if (processArgs.at(0)?.endsWith("/node")) {
    return processArgs.slice(2);
  }

  // script was run as an executeable
  return processArgs.slice(1);
}

function sleep(timeInSeconds: number): Promise<undefined> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(undefined), timeInSeconds * 1000);
  });
}

function toTimestamp(date: Date): string {
  const str = date.toISOString();
  return str.replace("T", " ").slice(0, str.indexOf("."));
}

function parseId(id: string | undefined): number {
  if (typeof id !== "string" || typeof id !== "string") {
    console.error("node task-cli.js update <id> <description>");
    return -1;
  }

  if (id.includes(".") || Number.isNaN(Number(id))) {
    console.error("Invalid <id>");
    return -1;
  }

  return parseInt(id);
}