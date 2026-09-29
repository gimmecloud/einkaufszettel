import { Router } from 'express';
import { z } from 'zod';
import { ShoppingItemModel } from '../models/shopping-item.js';

const createItemSchema = z.strictObject({ name: z.string().trim().min(1).max(120) });
const updateItemSchema = z.strictObject({ bought: z.boolean() });
export const itemsRouter = Router();

itemsRouter.param('id', (_req, res, next, id: string) => {
  if (!/^[a-f\d]{24}$/i.test(id)) {
    res.status(400).json({ error: 'Die Produkt-ID ist ungültig.' });
    return;
  }
  next();
});

itemsRouter.get('/', async (_req, res) => {
  const items = await ShoppingItemModel.find().sort({ createdAt: 1, _id: 1 }).lean();
  res.json(items);
});

itemsRouter.post('/', async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Bitte einen Produktnamen mit 1 bis 120 Zeichen angeben.' });
    return;
  }
  const item = await ShoppingItemModel.create(parsed.data);
  res.status(201).location(`/items/${item._id.toString()}`).json(item);
});

itemsRouter.put('/:id', async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Der gekauft-Status muss ein Boolean sein.' });
    return;
  }
  const item = await ShoppingItemModel.findByIdAndUpdate(
    req.params.id,
    { $set: { bought: parsed.data.bought } },
    { returnDocument: 'after', runValidators: true }
  );
  if (!item) {
    res.status(404).json({ error: 'Dieses Produkt ist nicht mehr auf der Liste.' });
    return;
  }
  res.json(item);
});

itemsRouter.delete('/:id', async (req, res) => {
  const item = await ShoppingItemModel.findByIdAndDelete(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Dieses Produkt ist nicht mehr auf der Liste.' });
    return;
  }
  res.status(204).end();
});
