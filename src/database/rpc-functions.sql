-- RPC function to claim daily reward atomically
CREATE OR REPLACE FUNCTION claim_daily_reward(p_user_id TEXT, p_reward INTEGER, p_cooldown_hours INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_cooldown_end TIMESTAMP;
  v_now TIMESTAMP := NOW();
BEGIN
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;
  
  IF v_user.last_daily IS NOT NULL THEN
    v_cooldown_end := v_user.last_daily + (p_cooldown_hours || ' hours')::INTERVAL;
    IF v_now < v_cooldown_end THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'on_cooldown',
        'cooldown_remaining_ms', EXTRACT(EPOCH FROM (v_cooldown_end - v_now)) * 1000
      );
    END IF;
  END IF;
  
  UPDATE users 
  SET coins = coins + p_reward, last_daily = v_now
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'old_balance', v_user.coins,
    'new_balance', v_user.coins + p_reward,
    'reward', p_reward
  );
END;
$$;

-- RPC function to claim weekly reward atomically
CREATE OR REPLACE FUNCTION claim_weekly_reward(p_user_id TEXT, p_reward INTEGER, p_cooldown_hours INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_cooldown_end TIMESTAMP;
  v_now TIMESTAMP := NOW();
BEGIN
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;
  
  IF v_user.last_weekly IS NOT NULL THEN
    v_cooldown_end := v_user.last_weekly + (p_cooldown_hours || ' hours')::INTERVAL;
    IF v_now < v_cooldown_end THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'on_cooldown',
        'cooldown_remaining_ms', EXTRACT(EPOCH FROM (v_cooldown_end - v_now)) * 1000
      );
    END IF;
  END IF;
  
  UPDATE users 
  SET coins = coins + p_reward, last_weekly = v_now
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'old_balance', v_user.coins,
    'new_balance', v_user.coins + p_reward,
    'reward', p_reward
  );
END;
$$;

-- RPC function to claim surf reward atomically
CREATE OR REPLACE FUNCTION claim_surf_reward(p_user_id TEXT, p_reward INTEGER, p_cooldown_hours INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_cooldown_end TIMESTAMP;
  v_now TIMESTAMP := NOW();
BEGIN
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;
  
  IF v_user.last_surf IS NOT NULL THEN
    v_cooldown_end := v_user.last_surf + (p_cooldown_hours || ' hours')::INTERVAL;
    IF v_now < v_cooldown_end THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'on_cooldown',
        'cooldown_remaining_ms', EXTRACT(EPOCH FROM (v_cooldown_end - v_now)) * 1000
      );
    END IF;
  END IF;
  
  UPDATE users 
  SET coins = coins + p_reward, last_surf = v_now
  WHERE user_id = p_user_id;
  
  RETURN json_build_object(
    'success', true, 
    'old_balance', v_user.coins,
    'new_balance', v_user.coins + p_reward,
    'reward', p_reward
  );
END;
$$;

-- RPC function to purchase a marketplace listing atomically
CREATE OR REPLACE FUNCTION purchase_marketplace_listing(p_buyer_id TEXT, p_listing_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_listing RECORD;
  v_buyer RECORD;
  v_seller RECORD;
  v_existing_card RECORD;
BEGIN
  SELECT * INTO v_listing FROM marketplace WHERE listing_id = p_listing_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'listing_not_found');
  END IF;
  
  IF v_listing.seller_id = p_buyer_id THEN
    RETURN json_build_object('success', false, 'error', 'cannot_buy_own_listing');
  END IF;
  
  SELECT * INTO v_buyer FROM users WHERE user_id = p_buyer_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'buyer_not_found');
  END IF;
  
  IF v_buyer.coins < v_listing.price THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'insufficient_funds',
      'required', v_listing.price,
      'available', v_buyer.coins
    );
  END IF;
  
  UPDATE users SET coins = coins - v_listing.price WHERE user_id = p_buyer_id;
  
  UPDATE users SET coins = coins + v_listing.price WHERE user_id = v_listing.seller_id;
  
  SELECT * INTO v_existing_card FROM inventory 
  WHERE user_id = p_buyer_id AND card_id = v_listing.card_id 
  FOR UPDATE;
  
  IF FOUND THEN
    UPDATE inventory 
    SET quantity = quantity + v_listing.quantity
    WHERE user_id = p_buyer_id AND card_id = v_listing.card_id;
  ELSE
    INSERT INTO inventory (user_id, card_id, quantity)
    VALUES (p_buyer_id, v_listing.card_id, v_listing.quantity);
  END IF;
  
  DELETE FROM marketplace WHERE listing_id = p_listing_id;
  
  RETURN json_build_object(
    'success', true,
    'card_id', v_listing.card_id,
    'quantity', v_listing.quantity,
    'price', v_listing.price,
    'new_balance', v_buyer.coins - v_listing.price
  );
END;
$$;

-- RPC function to list a card on marketplace atomically
CREATE OR REPLACE FUNCTION list_card_on_marketplace(p_user_id TEXT, p_card_id INTEGER, p_price INTEGER, p_quantity INTEGER, p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_inventory RECORD;
  v_new_listing_id INTEGER;
BEGIN
  SELECT * INTO v_inventory FROM inventory 
  WHERE user_id = p_user_id AND card_id = p_card_id 
  FOR UPDATE;
  
  IF NOT FOUND OR v_inventory.quantity < p_quantity THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'insufficient_cards',
      'available', COALESCE(v_inventory.quantity, 0)
    );
  END IF;
  
  IF v_inventory.quantity = p_quantity THEN
    DELETE FROM inventory WHERE id = v_inventory.id;
  ELSE
    UPDATE inventory 
    SET quantity = quantity - p_quantity
    WHERE id = v_inventory.id;
  END IF;
  
  INSERT INTO marketplace (seller_id, card_id, price, quantity, code)
  VALUES (p_user_id, p_card_id, p_price, p_quantity, p_code)
  RETURNING listing_id INTO v_new_listing_id;
  
  RETURN json_build_object(
    'success', true,
    'listing_id', v_new_listing_id,
    'card_id', p_card_id,
    'price', p_price,
    'quantity', p_quantity,
    'code', p_code
  );
END;
$$;

-- RPC function to open a card pack atomically
CREATE OR REPLACE FUNCTION open_card_pack(p_user_id TEXT, p_pack_cost INTEGER, p_card_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_user RECORD;
  v_existing_card RECORD;
BEGIN
  SELECT * INTO v_user FROM users WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'user_not_found');
  END IF;
  
  IF v_user.coins < p_pack_cost THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'insufficient_funds',
      'required', p_pack_cost,
      'available', v_user.coins
    );
  END IF;
  
  UPDATE users SET coins = coins - p_pack_cost WHERE user_id = p_user_id;
  
  SELECT * INTO v_existing_card FROM inventory 
  WHERE user_id = p_user_id AND card_id = p_card_id 
  FOR UPDATE;
  
  IF FOUND THEN
    UPDATE inventory 
    SET quantity = quantity + 1
    WHERE user_id = p_user_id AND card_id = p_card_id;
  ELSE
    INSERT INTO inventory (user_id, card_id, quantity)
    VALUES (p_user_id, p_card_id, 1);
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'new_balance', v_user.coins - p_pack_cost,
    'old_balance', v_user.coins
  );
END;
$$;
