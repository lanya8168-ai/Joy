-- 1. Add new columns to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_card INTEGER REFERENCES cards(card_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_color TEXT DEFAULT '#ff69b4';

-- 2. Clean up old booster/bonanza columns if they exist (optional, but keeps it tidy)
ALTER TABLE users DROP COLUMN IF EXISTS last_booster;
ALTER TABLE users DROP COLUMN IF EXISTS last_bonanza;

-- 3. Update the claim_explore_reward RPC to support staff (no cooldown)
CREATE OR REPLACE FUNCTION claim_explore_reward(p_user_id TEXT, p_reward INTEGER, p_cooldown_hours INTEGER)
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
  
  -- If p_cooldown_hours is 0 (Staff), we skip the cooldown check
  IF p_cooldown_hours > 0 AND v_user.last_surf IS NOT NULL THEN
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
    'reward', p_reward,
    'cooldown_remaining_ms', CASE WHEN p_cooldown_hours > 0 THEN p_cooldown_hours * 3600 * 1000 ELSE 0 END
  );
END;
$$;
