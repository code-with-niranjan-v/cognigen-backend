const mongoose = require("mongoose");
const LearningPath = require("../models/LearningPath");
const { migrateToCells } = require("../utils/contentMigration");

require("dotenv").config();

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected");

  const paths = await LearningPath.find({});

  for (const path of paths) {
    let changed = false;

    for (const topic of path.topics) {
      for (const sub of topic.submodules) {
        if (sub.contentVersion < 2) {
          Object.assign(sub, migrateToCells(sub));
          changed = true;
        }
      }
    }

    if (changed) {
      await path.save();
      console.log(`Migrated path ${path._id} (${path.title})`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
