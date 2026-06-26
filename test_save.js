const fs = require('fs');
const mongoose = require('mongoose');

// Simple parser for .env
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const MONGODB_URI = env.MONGODB_URI;

mongoose.connect(MONGODB_URI).then(async () => {
  console.log('Connected!');
  const db = mongoose.connection.db;
  
  // Find last plan
  const plans = await db.collection('plans').find({}).toArray();
  if (plans.length === 0) {
    console.log('No plans found.');
    process.exit(0);
  }
  
  const planDoc = plans[plans.length - 1];
  console.log('Plan:', planDoc.title, '_id:', planDoc._id);
  
  if (!planDoc.diagnostics || !planDoc.diagnostics.rawGeminiOutput) {
    console.log('No diagnostics/rawGeminiOutput found.');
    process.exit(0);
  }
  
  const parsed = JSON.parse(planDoc.diagnostics.rawGeminiOutput);
  const normalizedPlan = parsed.plan;
  const planId = planDoc._id;
  const uid = planDoc.firebaseUid;
  
  console.log('Normalizing and persisting milestones, goals, and tasks...');
  
  const Milestone = mongoose.model('Milestone', new mongoose.Schema({
    planId: { type: mongoose.Schema.Types.ObjectId, required: true },
    firebaseUid: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "todo" },
    priority: { type: Number, default: 1 },
    estimatedDuration: { type: String, default: "" },
    progress: { type: Number, default: 0 },
  }, { collection: 'milestones' }));

  const Goal = mongoose.model('Goal', new mongoose.Schema({
    firebaseUid: { type: String, required: true },
    planId: { type: mongoose.Schema.Types.ObjectId },
    milestoneId: { type: mongoose.Schema.Types.ObjectId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "active" },
    priority: { type: Number, default: 1 },
    estimatedDuration: { type: String, default: "" },
    progress: { type: Number, default: 0 },
  }, { collection: 'goals' }));

  const Task = mongoose.model('Task', new mongoose.Schema({
    firebaseUid: { type: String, required: true },
    goalId: { type: mongoose.Schema.Types.ObjectId },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, default: "todo" },
    priority: { type: Number, default: 1 },
    estimatedDuration: { type: String, default: "" },
    dependencies: [{ type: String }],
  }, { collection: 'tasks' }));

  try {
    const milestoneIdsInPayload = new Set();
    const goalIdsInPayload = new Set();
    const taskIdsInPayload = new Set();

    for (const milestone of normalizedPlan.milestones) {
      console.log('Creating Milestone:', milestone.title);
      let milestoneDoc;
      if (milestone.id && mongoose.Types.ObjectId.isValid(milestone.id)) {
        milestoneDoc = await Milestone.findByIdAndUpdate(
          milestone.id,
          {
            $set: {
              title: milestone.title,
              description: milestone.description || "",
              status: milestone.status,
              priority: milestone.priority,
              estimatedDuration: milestone.estimatedDuration,
            },
          },
          { new: true }
        );
        milestoneIdsInPayload.add(milestone.id);
      } else {
        milestoneDoc = await Milestone.create({
          planId,
          firebaseUid: uid,
          title: milestone.title,
          description: milestone.description || "",
          status: milestone.status || "todo",
          priority: milestone.priority || 1,
          estimatedDuration: milestone.estimatedDuration,
          progress: 0,
        });
      }

      const milestoneId = milestoneDoc._id;

      for (const goal of milestone.goals) {
        console.log('  Creating Goal:', goal.title);
        let goalDoc;
        if (goal.id && mongoose.Types.ObjectId.isValid(goal.id)) {
          goalDoc = await Goal.findByIdAndUpdate(
            goal.id,
            {
              $set: {
                planId,
                milestoneId,
                title: goal.title,
                description: goal.description || "",
                status: goal.status,
                priority: goal.priority,
                estimatedDuration: goal.estimatedDuration,
              },
            },
            { new: true }
          );
          goalIdsInPayload.add(goal.id);
        } else {
          goalDoc = await Goal.create({
            firebaseUid: uid,
            planId,
            milestoneId,
            title: goal.title,
            description: goal.description || "",
            status: goal.status || "active",
            priority: goal.priority || 1,
            estimatedDuration: goal.estimatedDuration,
            progress: 0,
          });
        }

        const goalId = goalDoc._id;

        for (const task of goal.tasks) {
          console.log('    Creating Task:', task.title);
          let taskDoc;
          if (task.id && mongoose.Types.ObjectId.isValid(task.id)) {
            taskDoc = await Task.findByIdAndUpdate(
              task.id,
              {
                $set: {
                  goalId,
                  title: task.title,
                  description: task.description || "",
                  status: task.status,
                  priority: task.priority,
                  estimatedDuration: task.estimatedDuration,
                  dependencies: task.dependencies || [],
                },
              },
              { new: true }
            );
            taskIdsInPayload.add(task.id);
          } else {
            taskDoc = await Task.create({
              firebaseUid: uid,
              goalId,
              title: task.title,
              description: task.description || "",
              status: task.status || "todo",
              priority: task.priority || 1,
              estimatedDuration: task.estimatedDuration,
              dependencies: task.dependencies || [],
            });
          }
        }
      }
    }
    
    console.log('Success! Milestones, goals, and tasks created.');
  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
  }

  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
