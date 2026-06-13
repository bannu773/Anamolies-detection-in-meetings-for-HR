import { Router } from "express";
import { Project } from "../models/Project.js";
import { Employee } from "../models/Employee.js";

const router = Router();

/** GET /meta/projects — project names + budget/priority (for dropdowns & labels). */
router.get("/projects", async (_req, res) => {
  try {
    const projects = await Project.find().sort({ name: 1 }).lean();
    res.json(
      projects.map((p) => ({
        name: p.name,
        priority: p.priority,
        budget: p.budget,
        description: p.description,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /meta/teams — distinct employee teams (for the dashboard team filter). */
router.get("/teams", async (_req, res) => {
  try {
    const teams = await Employee.distinct("team");
    res.json(teams.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
