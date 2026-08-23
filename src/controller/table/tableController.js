import Table            from "../../models/Table/Table.js";
import TableReservation from "../../models/TableReservation/TableReservation.js";

// POST /api/tables  (admin only)
export const createTable = async (req, res) => {
  try {
    const { tableNumber, capacity, location } = req.body;

    if (!tableNumber || !capacity) {
      return res.status(400).json({ success: false, message: "tableNumber and capacity are required" });
    }

    const existing = await Table.findOne({ tableNumber });
    if (existing) {
      return res.status(409).json({ success: false, message: `Table ${tableNumber} already exists` });
    }

    const table = await Table.create({ tableNumber, capacity: Number(capacity), location });

    return res.status(201).json({ success: true, message: "Table created successfully", table });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/tables  (any authenticated user)
// ?includeInactive=true  ?capacity=4  ?location=indoor
export const getTables = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = req.query.includeInactive === "true" ? {} : { isActive: true };

    if (req.query.location) filter.location = req.query.location;
    if (req.query.capacity)  filter.capacity = { $gte: Number(req.query.capacity) };

    const [tables, total] = await Promise.all([
      Table.find(filter).skip(skip).limit(limit),
      Table.countDocuments(filter),
    ]);

    return res.status(200).json({ success: true, total, page, pages: Math.ceil(total / limit), tables });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch tables", error: error.message });
  }
};

// GET /api/tables/:id  (any authenticated user)
export const getTableById = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: "Table not found" });
    return res.status(200).json({ success: true, table });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch table", error: error.message });
  }
};

// PUT /api/tables/:id  (admin only)
export const updateTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: "Table not found" });

    const updates = { ...req.body };

    const updated = await Table.findByIdAndUpdate(req.params.id, updates, {
      new:           true,
      runValidators: true,
    });

    return res.status(200).json({ success: true, message: "Table updated successfully", table: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update table", error: error.message });
  }
};

// PUT /api/tables/:id/deactivate  (admin only)
export const deactivateTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: "Table not found" });

    const activeReservation = await TableReservation.findOne({
      table:  req.params.id,
      status: { $in: ["reserved", "seated"] },
    });

    if (activeReservation) {
      return res.status(400).json({
        success: false,
        message: "Cannot deactivate a table with an active or upcoming reservation. Wait until the current reservation is complete.",
      });
    }

    table.isActive = false;
    await table.save();

    return res.status(200).json({ success: true, message: "Table deactivated", table });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to deactivate table", error: error.message });
  }
};

// PUT /api/tables/:id/activate  (admin only)
export const activateTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: "Table not found" });

    table.isActive = true;
    await table.save();

    return res.status(200).json({ success: true, message: "Table activated", table });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to activate table", error: error.message });
  }
};

// DELETE /api/tables/:id  (admin only)
export const deleteTable = async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.status(404).json({ success: false, message: "Table not found" });

    const anyReservation = await TableReservation.findOne({ table: req.params.id });
    if (anyReservation) {
      return res.status(400).json({
        success: false,
        message: "This table has reservation history and cannot be permanently deleted. Deactivate it instead.",
      });
    }

    await Table.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: "Table deleted successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete table", error: error.message });
  }
};
