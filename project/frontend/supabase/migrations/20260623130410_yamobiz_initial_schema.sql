-- YamoBiz database schema

-- Businesses (PME accounts)
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT 'Douala',
  sector TEXT,
  plan TEXT NOT NULL DEFAULT 'standard' CHECK (plan IN ('standard', 'premium')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_business" ON businesses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_business" ON businesses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_business" ON businesses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_business" ON businesses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  total_credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_customers" ON customers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "insert_own_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "update_own_customers" ON customers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "delete_own_customers" ON customers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = customers.business_id AND businesses.user_id = auth.uid())
  );

-- Products / Stock
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'unité',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_qty NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_alert NUMERIC(12,2) NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = products.business_id AND businesses.user_id = auth.uid())
  );

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  payment_type TEXT NOT NULL DEFAULT 'cash' CHECK (payment_type IN ('cash', 'credit', 'momo')),
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sales" ON sales FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "insert_own_sales" ON sales FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "update_own_sales" ON sales FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "delete_own_sales" ON sales FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = sales.business_id AND businesses.user_id = auth.uid())
  );

-- Sale line items
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  qty NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sale_items" ON sale_items FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sales
      JOIN businesses ON businesses.id = sales.business_id
      WHERE sales.id = sale_items.sale_id AND businesses.user_id = auth.uid()
    )
  );
CREATE POLICY "insert_own_sale_items" ON sale_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      JOIN businesses ON businesses.id = sales.business_id
      WHERE sales.id = sale_items.sale_id AND businesses.user_id = auth.uid()
    )
  );
CREATE POLICY "update_own_sale_items" ON sale_items FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sales
      JOIN businesses ON businesses.id = sales.business_id
      WHERE sales.id = sale_items.sale_id AND businesses.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      JOIN businesses ON businesses.id = sales.business_id
      WHERE sales.id = sale_items.sale_id AND businesses.user_id = auth.uid()
    )
  );
CREATE POLICY "delete_own_sale_items" ON sale_items FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM sales
      JOIN businesses ON businesses.id = sales.business_id
      WHERE sales.id = sale_items.sale_id AND businesses.user_id = auth.uid()
    )
  );

-- Credits (créances clients)
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  due_date DATE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_credits" ON credits FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = credits.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "insert_own_credits" ON credits FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = credits.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "update_own_credits" ON credits FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = credits.business_id AND businesses.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = credits.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "delete_own_credits" ON credits FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = credits.business_id AND businesses.user_id = auth.uid())
  );

-- WhatsApp simulator messages
CREATE TABLE bot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'voice', 'image')),
  action_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_bot_messages" ON bot_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = bot_messages.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "insert_own_bot_messages" ON bot_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = bot_messages.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "update_own_bot_messages" ON bot_messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = bot_messages.business_id AND businesses.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = bot_messages.business_id AND businesses.user_id = auth.uid())
  );
CREATE POLICY "delete_own_bot_messages" ON bot_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM businesses WHERE businesses.id = bot_messages.business_id AND businesses.user_id = auth.uid())
  );
