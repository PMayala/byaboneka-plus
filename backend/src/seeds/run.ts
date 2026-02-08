import dotenv from 'dotenv';
dotenv.config();

import { query, closePool } from '../config/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ============================================
// BYABONEKA+ SEED DATA
// Trust-Aware Lost & Found Infrastructure
// ============================================

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function hashAnswer(answer: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.randomBytes(16).toString('hex');
  const normalized = answer.toLowerCase().trim();
  const hash = await bcrypt.hash(normalized + salt, 10);
  return { hash, salt };
}

async function seed(): Promise<void> {
  console.log('🌱 Seeding database...');

  // Clear existing data (in correct dependency order)
  // First, remove the FK reference from cooperatives to users
  await query('UPDATE cooperatives SET verified_by = NULL WHERE verified_by IS NOT NULL');
  
  // Now delete in reverse dependency order
  await query('DELETE FROM audit_logs');
  await query('DELETE FROM scam_reports');
  await query('DELETE FROM messages');
  await query('DELETE FROM handover_confirmations');
  await query('DELETE FROM verification_attempts');
  await query('DELETE FROM claims');
  await query('DELETE FROM matches');
  await query('DELETE FROM verification_secrets');
  await query('DELETE FROM found_items');
  await query('DELETE FROM lost_items');
  await query('DELETE FROM refresh_tokens');
  await query('DELETE FROM password_reset_tokens');
  await query('DELETE FROM cooperatives');
  await query('DELETE FROM users');

  // Reset sequences
  await query("ALTER SEQUENCE cooperatives_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE users_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE lost_items_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE found_items_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE verification_secrets_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE claims_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE messages_id_seq RESTART WITH 1");

  // ==================== COOPERATIVES ====================
  console.log('  Creating cooperatives...');
  
  // Verified cooperative
  const coopResult = await query(`
    INSERT INTO cooperatives (name, registration_number, status, contact_info, address, verified_at)
    VALUES 
      ('Kigali Moto-Taxi Cooperative', 'RW-COOP-2024-001', 'VERIFIED', 
       '{"phone": "+250788123456", "email": "info@kigalimoto.rw"}', 
       'Nyabugogo Bus Park, Kigali', NOW()),
      ('Nyamirambo Transport Union', 'RW-COOP-2024-002', 'PENDING',
       '{"phone": "+250788654321", "email": "contact@nyatransport.rw"}',
       'Nyamirambo Main Road, Kigali', NULL)
    RETURNING id
  `);

  const verifiedCoopId = coopResult.rows[0].id;
  const pendingCoopId = coopResult.rows[1].id;

  // ==================== USERS ====================
  console.log('  Creating users...');
  
  const adminPassword = await hashPassword('Admin@123');
  const userPassword = await hashPassword('User@123');

  const usersResult = await query(`
    INSERT INTO users (email, phone, password_hash, name, role, trust_score, cooperative_id, email_verified)
    VALUES 
      -- Admin
      ('admin@byaboneka.rw', '+250788000001', $1, 'System Admin', 'admin', 100, NULL, true),
      
      -- Cooperative Staff (verified coop)
      ('staff1@kigalimoto.rw', '+250788000002', $2, 'Jean Baptiste Mugisha', 'coop_staff', 15, $3, true),
      ('staff2@kigalimoto.rw', '+250788000003', $2, 'Marie Claire Uwamahoro', 'coop_staff', 10, $3, true),
      
      -- Citizens
      ('emmanuel.k@gmail.com', '+250788111111', $2, 'Emmanuel Kamanzi', 'citizen', 8, NULL, true),
      ('alice.m@yahoo.com', '+250788222222', $2, 'Alice Mukamana', 'citizen', 5, NULL, true),
      ('patrick.n@outlook.com', '+250788333333', $2, 'Patrick Niyonzima', 'citizen', 0, NULL, true),
      ('grace.u@gmail.com', '+250788444444', $2, 'Grace Uwimana', 'citizen', -2, NULL, true),
      ('david.h@gmail.com', '+250788555555', $2, 'David Habimana', 'citizen', 12, NULL, true)
    RETURNING id, name, role
  `, [adminPassword, userPassword, verifiedCoopId]);

  const adminId = usersResult.rows[0].id;
  const coopStaff1Id = usersResult.rows[1].id;
  const coopStaff2Id = usersResult.rows[2].id;
  const emmanuelId = usersResult.rows[3].id;
  const aliceId = usersResult.rows[4].id;
  const patrickId = usersResult.rows[5].id;
  const graceId = usersResult.rows[6].id;
  const davidId = usersResult.rows[7].id;

  // Update verified_by for cooperative
  await query(`UPDATE cooperatives SET verified_by = $1 WHERE id = $2`, [adminId, verifiedCoopId]);

  // ==================== LOST ITEMS ====================
  console.log('  Creating lost items...');

  // Lost iPhone - Emmanuel
  const lostIphoneResult = await query(`
    INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, status, keywords)
    VALUES ($1, 'PHONE', 'Black iPhone 13 Pro', 
            'Lost my black iPhone 13 Pro with a dark blue silicone case. Has a small crack on the bottom right corner of the screen. Phone was in silent mode.',
            'Kimironko', 'Near Kimironko Market main entrance, around the moto-taxi parking area',
            NOW() - INTERVAL '2 days', 'ACTIVE',
            ARRAY['black', 'iphone', '13', 'pro', 'blue', 'case', 'crack', 'screen'])
    RETURNING id
  `, [emmanuelId]);
  const lostIphoneId = lostIphoneResult.rows[0].id;

  // Lost wallet - Alice
  const lostWalletResult = await query(`
    INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, status, keywords)
    VALUES ($1, 'WALLET', 'Brown leather wallet with ID', 
            'Brown leather wallet containing my national ID, BK bank card, and some cash (about 15,000 RWF). The wallet has my initials AM embossed on the front.',
            'Nyabugogo', 'Lost on a bus from Nyabugogo to Muhanga, probably fell from my pocket',
            NOW() - INTERVAL '1 day', 'ACTIVE',
            ARRAY['brown', 'leather', 'wallet', 'id', 'bank', 'card', 'bk', 'embossed', 'am'])
    RETURNING id
  `, [aliceId]);
  const lostWalletId = lostWalletResult.rows[0].id;

  // Lost keys - Patrick  
  const lostKeysResult = await query(`
    INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, status, keywords)
    VALUES ($1, 'KEYS', 'House and car keys on blue keychain', 
            'Set of 4 keys including Toyota car key (black remote), 2 house keys, and a small padlock key. All on a blue rubber keychain with a small torch attached.',
            'Kacyiru', 'Somewhere between KG 7 Ave and Kacyiru Centre',
            NOW() - INTERVAL '3 days', 'ACTIVE',
            ARRAY['keys', 'toyota', 'car', 'house', 'blue', 'keychain', 'torch', 'padlock'])
    RETURNING id
  `, [patrickId]);
  const lostKeysId = lostKeysResult.rows[0].id;

  // Lost bag - Grace
  const lostBagResult = await query(`
    INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, status, keywords)
    VALUES ($1, 'BAG', 'Red backpack with laptop', 
            'Red Samsonite backpack containing my HP laptop, charger, notebook, and some textbooks. The bag has a small Rwanda flag pin on the front pocket.',
            'Remera', 'Left in a moto-taxi coming from Remera Taxi Park',
            NOW() - INTERVAL '5 days', 'ACTIVE',
            ARRAY['red', 'backpack', 'samsonite', 'laptop', 'hp', 'charger', 'books', 'rwanda', 'flag'])
    RETURNING id
  `, [graceId]);
  const lostBagId = lostBagResult.rows[0].id;

  // Lost ID - David
  const lostIdResult = await query(`
    INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, status, keywords)
    VALUES ($1, 'ID', 'National ID Card', 
            'Lost my national ID card. The ID has my photo and name David Habimana.',
            'Gisozi', 'Possibly dropped near Gisozi Genocide Memorial or on the way to Kacyiru',
            NOW() - INTERVAL '4 days', 'ACTIVE',
            ARRAY['national', 'id', 'card', 'david', 'habimana'])
    RETURNING id
  `, [davidId]);
  const lostIdCardId = lostIdResult.rows[0].id;

  // ==================== VERIFICATION SECRETS ====================
  console.log('  Creating verification secrets...');

  // iPhone secrets
  const iphoneA1 = await hashAnswer('mountains');
  const iphoneA2 = await hashAnswer('3');
  const iphoneA3 = await hashAnswer('spotify');
  await query(`
    INSERT INTO verification_secrets (lost_item_id, question_1_text, answer_1_hash, answer_1_salt, 
                                      question_2_text, answer_2_hash, answer_2_salt,
                                      question_3_text, answer_3_hash, answer_3_salt)
    VALUES ($1, 
            'What is on your lockscreen wallpaper?', $2, $3,
            'How many apps are in your dock?', $4, $5,
            'What music app is on your home screen?', $6, $7)
  `, [lostIphoneId, iphoneA1.hash, iphoneA1.salt, iphoneA2.hash, iphoneA2.salt, iphoneA3.hash, iphoneA3.salt]);

  // Wallet secrets
  const walletA1 = await hashAnswer('2');
  const walletA2 = await hashAnswer('photo of my daughter');
  const walletA3 = await hashAnswer('15000');
  await query(`
    INSERT INTO verification_secrets (lost_item_id, question_1_text, answer_1_hash, answer_1_salt, 
                                      question_2_text, answer_2_hash, answer_2_salt,
                                      question_3_text, answer_3_hash, answer_3_salt)
    VALUES ($1, 
            'How many bank cards are in the wallet?', $2, $3,
            'What personal item is in the clear photo slot?', $4, $5,
            'Approximately how much cash was inside (in RWF)?', $6, $7)
  `, [lostWalletId, walletA1.hash, walletA1.salt, walletA2.hash, walletA2.salt, walletA3.hash, walletA3.salt]);

  // Keys secrets
  const keysA1 = await hashAnswer('4');
  const keysA2 = await hashAnswer('black');
  const keysA3 = await hashAnswer('yes');
  await query(`
    INSERT INTO verification_secrets (lost_item_id, question_1_text, answer_1_hash, answer_1_salt, 
                                      question_2_text, answer_2_hash, answer_2_salt,
                                      question_3_text, answer_3_hash, answer_3_salt)
    VALUES ($1, 
            'How many keys are on the keychain?', $2, $3,
            'What color is the car key remote?', $4, $5,
            'Does the keychain have a torch attached?', $6, $7)
  `, [lostKeysId, keysA1.hash, keysA1.salt, keysA2.hash, keysA2.salt, keysA3.hash, keysA3.salt]);

  // Bag secrets
  const bagA1 = await hashAnswer('hp');
  const bagA2 = await hashAnswer('software engineering');
  const bagA3 = await hashAnswer('rwanda flag pin');
  await query(`
    INSERT INTO verification_secrets (lost_item_id, question_1_text, answer_1_hash, answer_1_salt, 
                                      question_2_text, answer_2_hash, answer_2_salt,
                                      question_3_text, answer_3_hash, answer_3_salt)
    VALUES ($1, 
            'What brand is the laptop inside?', $2, $3,
            'What subject are the textbooks for?', $4, $5,
            'What is attached to the front pocket?', $6, $7)
  `, [lostBagId, bagA1.hash, bagA1.salt, bagA2.hash, bagA2.salt, bagA3.hash, bagA3.salt]);

  // ID secrets
  const idA1 = await hashAnswer('habi');
  const idA2 = await hashAnswer('gasabo');
  const idA3 = await hashAnswer('1990');
  await query(`
    INSERT INTO verification_secrets (lost_item_id, question_1_text, answer_1_hash, answer_1_salt, 
                                      question_2_text, answer_2_hash, answer_2_salt,
                                      question_3_text, answer_3_hash, answer_3_salt)
    VALUES ($1, 
            'What are the last 4 characters of your ID number?', $2, $3,
            'What district is shown on the ID?', $4, $5,
            'What is your birth year on the ID?', $6, $7)
  `, [lostIdCardId, idA1.hash, idA1.salt, idA2.hash, idA2.salt, idA3.hash, idA3.salt]);

  // ==================== FOUND ITEMS ====================
  console.log('  Creating found items...');

  // Found iPhone (matches Emmanuel's lost iPhone)
  const foundIphoneResult = await query(`
    INSERT INTO found_items (finder_id, cooperative_id, category, title, description, location_area, location_hint, 
                            found_date, status, source, image_urls, keywords)
    VALUES ($1, $2, 'PHONE', 'iPhone found at Kimironko', 
            'Found an iPhone near the market. Black phone with blue case. Screen has some damage.',
            'Kimironko', 'Found near the main entrance to Kimironko Market',
            NOW() - INTERVAL '1 day', 'UNCLAIMED', 'COOPERATIVE',
            ARRAY['/uploads/found_iphone_1.jpg'],
            ARRAY['iphone', 'black', 'blue', 'case', 'screen', 'damage'])
    RETURNING id
  `, [coopStaff1Id, verifiedCoopId]);
  const foundIphoneId = foundIphoneResult.rows[0].id;

  // Found wallet (matches Alice's lost wallet)
  const foundWalletResult = await query(`
    INSERT INTO found_items (finder_id, category, title, description, location_area, location_hint,
                            found_date, status, source, image_urls, keywords)
    VALUES ($1, 'WALLET', 'Brown wallet found on Muhanga bus', 
            'Found a brown leather wallet on the floor of Volcano bus going to Muhanga. Contains cards and some money. Has initials on front.',
            'Nyabugogo', 'Found on Volcano Express bus #45',
            NOW() - INTERVAL '12 hours', 'UNCLAIMED', 'CITIZEN',
            ARRAY['/uploads/found_wallet_1.jpg', '/uploads/found_wallet_2.jpg'],
            ARRAY['brown', 'leather', 'wallet', 'cards', 'initials', 'bus'])
    RETURNING id
  `, [davidId]);
  const foundWalletId = foundWalletResult.rows[0].id;

  // Found keys (partial match to Patrick's keys)
  await query(`
    INSERT INTO found_items (finder_id, category, title, description, location_area, location_hint,
                            found_date, status, source, image_urls, keywords)
    VALUES ($1, 'KEYS', 'Car keys with blue keychain', 
            'Found a set of keys including what looks like a Toyota key. Blue keychain with small flashlight.',
            'Kacyiru', 'Found on the sidewalk near Kacyiru Health Center',
            NOW() - INTERVAL '2 days', 'UNCLAIMED', 'CITIZEN',
            ARRAY['/uploads/found_keys_1.jpg'],
            ARRAY['keys', 'toyota', 'blue', 'keychain', 'flashlight', 'car'])
  `, [aliceId]);

  // Found bag (different area - no match)
  await query(`
    INSERT INTO found_items (finder_id, cooperative_id, category, title, description, location_area, location_hint,
                            found_date, status, source, image_urls, keywords)
    VALUES ($1, $2, 'BAG', 'Black backpack found at bus station', 
            'Black Nike backpack found at Nyabugogo main station. Contains some books and electronics.',
            'Nyabugogo', 'Left at Platform 3 waiting area',
            NOW() - INTERVAL '1 day', 'UNCLAIMED', 'COOPERATIVE',
            ARRAY['/uploads/found_bag_1.jpg'],
            ARRAY['black', 'nike', 'backpack', 'books', 'electronics'])
  `, [coopStaff2Id, verifiedCoopId]);

  // Found phone - different type
  await query(`
    INSERT INTO found_items (finder_id, category, title, description, location_area, location_hint,
                            found_date, status, source, image_urls, keywords)
    VALUES ($1, 'PHONE', 'Samsung phone found in taxi', 
            'Samsung Galaxy phone found in taxi. Blue color, cracked screen protector.',
            'Remera', 'Found in back seat of taxi going to Kimihurura',
            NOW() - INTERVAL '3 days', 'UNCLAIMED', 'CITIZEN',
            ARRAY['/uploads/found_samsung_1.jpg'],
            ARRAY['samsung', 'galaxy', 'blue', 'cracked', 'screen', 'taxi'])
  `, [patrickId]);

  // ==================== MATCHES ====================
  console.log('  Computing and storing matches...');

  // Pre-compute match: iPhone
  await query(`
    INSERT INTO matches (lost_item_id, found_item_id, score, explanation, computed_at)
    VALUES ($1, $2, 13, 
            ARRAY['Category match: PHONE (+5)', 'Same location: Kimironko (+5)', 'Within 24h (+3)', 'Keyword: iphone (+1)', 'Keyword: black (+1)', 'Keyword: case (+1)'],
            NOW())
  `, [lostIphoneId, foundIphoneId]);

  // Pre-compute match: Wallet
  await query(`
    INSERT INTO matches (lost_item_id, found_item_id, score, explanation, computed_at)
    VALUES ($1, $2, 12, 
            ARRAY['Category match: WALLET (+5)', 'Same location: Nyabugogo (+5)', 'Within 24h (+3)', 'Keyword: brown (+1)', 'Keyword: leather (+1)'],
            NOW())
  `, [lostWalletId, foundWalletId]);

  // ==================== SAMPLE CLAIM (Verified) ====================
  console.log('  Creating sample claim...');

  // Alice claims the found wallet (her item)
  const claimResult = await query(`
    INSERT INTO claims (lost_item_id, found_item_id, claimant_id, status, verification_score, attempts_made)
    VALUES ($1, $2, $3, 'VERIFIED', 1.00, 1)
    RETURNING id
  `, [lostWalletId, foundWalletId, aliceId]);
  const claimId = claimResult.rows[0].id;

  // Add verification attempt record
  await query(`
    INSERT INTO verification_attempts (claim_id, correct_answers, attempt_status, ip_address)
    VALUES ($1, 3, 'PASSED', '192.168.1.100')
  `, [claimId]);

  // Generate OTP for handover
  const otpHash = await bcrypt.hash('123456', 10);
  await query(`
    INSERT INTO handover_confirmations (claim_id, otp_code_hash, otp_expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '24 hours')
  `, [claimId, otpHash]);

  // ==================== SAMPLE MESSAGES ====================
  console.log('  Creating sample messages...');

  await query(`
    INSERT INTO messages (sender_id, receiver_id, claim_id, content, is_read)
    VALUES 
      ($1, $2, $3, 'Hello! Thank you for finding my wallet. When can we meet for the handover?', true),
      ($2, $1, $3, 'Hi Alice! I can meet at Nyabugogo bus station tomorrow morning around 9am. Is that okay?', true),
      ($1, $2, $3, 'Perfect! I will be there. I will give you the OTP code when we meet. Thank you so much!', false)
  `, [aliceId, davidId, claimId]);

  // ==================== AUDIT LOGS ====================
  console.log('  Creating audit log entries...');

  await query(`
    INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes, ip_address)
    VALUES 
      ($1, 'CREATE', 'lost_item', $2, '{"title": "Black iPhone 13 Pro"}', '192.168.1.100'),
      ($3, 'CREATE', 'found_item', $4, '{"title": "iPhone found at Kimironko"}', '192.168.1.101'),
      ($5, 'CLAIM_VERIFIED', 'claim', $6, '{"status": "VERIFIED", "score": 1.00}', '192.168.1.102'),
      ($5, 'OTP_GENERATED', 'handover', $6, '{"expires_at": "24 hours"}', '192.168.1.102'),
      ($7, 'COOP_APPROVED', 'cooperative', $8, '{"status": "VERIFIED"}', '192.168.1.1')
  `, [emmanuelId, lostIphoneId, coopStaff1Id, foundIphoneId, aliceId, claimId, adminId, verifiedCoopId]);

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📋 Test Accounts:');
  console.log('   Admin:      admin@byaboneka.rw / Admin@123');
  console.log('   Coop Staff: staff1@kigalimoto.rw / User@123');
  console.log('   Citizen:    emmanuel.k@gmail.com / User@123');
  console.log('   Citizen:    alice.m@yahoo.com / User@123');
  console.log('');
  console.log('🔐 Sample Verification Answers:');
  console.log('   iPhone: mountains, 3, spotify');
  console.log('   Wallet: 2, photo of my daughter, 15000');
  console.log('');
  console.log('📱 Sample OTP: 123456 (for Alice\'s wallet claim)');
}

// Run seeder
seed()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
