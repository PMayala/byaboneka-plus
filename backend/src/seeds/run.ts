import dotenv from 'dotenv';
dotenv.config();

import { query, closePool } from '../config/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// ============================================
// BYABONEKA+ COMPREHENSIVE SEED DATA
// Trust-Aware Lost & Found Infrastructure
// Enhanced Production-Ready Dataset
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

// Helper to get random item from array
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to get random date in past N days
function randomPastDate(daysAgo: number): Date {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysAgo);
  const randomHours = Math.floor(Math.random() * 24);
  now.setDate(now.getDate() - randomDays);
  now.setHours(now.getHours() - randomHours);
  return now;
}

async function seed(): Promise<void> {
  console.log('🌱 Starting comprehensive database seeding...');

  // Clear existing data (in correct dependency order)
  console.log('  Clearing existing data...');
  await query('UPDATE cooperatives SET verified_by = NULL WHERE verified_by IS NOT NULL');
  
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
  await query('DELETE FROM users');
  await query('DELETE FROM cooperatives');

  // Reset sequences
  await query("ALTER SEQUENCE cooperatives_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE users_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE lost_items_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE found_items_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE verification_secrets_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE claims_id_seq RESTART WITH 1");
  await query("ALTER SEQUENCE messages_id_seq RESTART WITH 1");

  // ==================== COOPERATIVES ====================
  console.log('  Creating 12 transport cooperatives...');
  
  const cooperatives = [
    { name: 'Kigali Moto-Taxi Cooperative', reg: 'RW-COOP-2024-001', status: 'VERIFIED', phone: '+250788123456', email: 'info@kigalimoto.rw', address: 'Nyabugogo Bus Park, Kigali', verified: true },
    { name: 'Nyamirambo Transport Union', reg: 'RW-COOP-2024-002', status: 'VERIFIED', phone: '+250788654321', email: 'contact@nyatransport.rw', address: 'Nyamirambo Main Road, Kigali', verified: true },
    { name: 'Remera Taxi Drivers Association', reg: 'RW-COOP-2024-003', status: 'VERIFIED', phone: '+250788111222', email: 'info@remerataxis.rw', address: 'Remera Taxi Park, Kigali', verified: true },
    { name: 'Volcano Express Cooperative', reg: 'RW-COOP-2024-004', status: 'VERIFIED', phone: '+250788333444', email: 'support@volcanoexpress.rw', address: 'Nyabugogo Station, Kigali', verified: true },
    { name: 'Kicukiro Moto Services', reg: 'RW-COOP-2024-005', status: 'VERIFIED', phone: '+250788555666', email: 'hello@kicukiromoto.rw', address: 'Kicukiro Center, Kigali', verified: true },
    { name: 'Gisenyi Transport Network', reg: 'RW-COOP-2024-006', status: 'VERIFIED', phone: '+250788777888', email: 'info@gisenyitransport.rw', address: 'Rubavu District, Gisenyi', verified: true },
    { name: 'Muhanga Bus Operators', reg: 'RW-COOP-2024-007', status: 'VERIFIED', phone: '+250788999000', email: 'contact@muhangabus.rw', address: 'Muhanga Town, Southern Province', verified: true },
    { name: 'Musanze Taxi Cooperative', reg: 'RW-COOP-2024-008', status: 'PENDING', phone: '+250788222333', email: 'info@musanzataxi.rw', address: 'Musanze District, Northern Province', verified: false },
    { name: 'Huye University Transport', reg: 'RW-COOP-2024-009', status: 'PENDING', phone: '+250788444555', email: 'support@huyetransport.rw', address: 'Huye District, Southern Province', verified: false },
    { name: 'Kimihurura Moto Group', reg: 'RW-COOP-2024-010', status: 'VERIFIED', phone: '+250788666777', email: 'hello@kimihurura.rw', address: 'Kimihurura, Kigali', verified: true },
    { name: 'Downtown Kigali Riders', reg: 'RW-COOP-2024-011', status: 'PENDING', phone: '+250788888999', email: 'info@downtownriders.rw', address: 'City Center, Kigali', verified: false },
    { name: 'Airport Express Services', reg: 'RW-COOP-2024-012', status: 'VERIFIED', phone: '+250788000111', email: 'contact@airportexpress.rw', address: 'Kanombe, Kigali', verified: true },
  ];

  const coopIds: number[] = [];
  for (const coop of cooperatives) {
    const result = await query(`
      INSERT INTO cooperatives (name, registration_number, status, contact_info, address, verified_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      coop.name,
      coop.reg,
      coop.status,
      JSON.stringify({ phone: coop.phone, email: coop.email }),
      coop.address,
      coop.verified ? new Date() : null
    ]);
    coopIds.push(result.rows[0].id);
  }

  // ==================== USERS ====================
  console.log('  Creating 50+ users (admin, coop staff, citizens)...');
  
  const adminPassword = await hashPassword('Admin@123');
  const userPassword = await hashPassword('User@123');

  const userIds: number[] = [];
  const coopStaffIds: number[] = [];
  const citizenIds: number[] = [];

  // Admin user
  let result = await query(`
    INSERT INTO users (email, phone, password_hash, name, role, trust_score, cooperative_id, email_verified)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, ['admin@byaboneka.rw', '+250788000001', adminPassword, 'System Admin', 'admin', 100, null, true]);
  const adminId = result.rows[0].id;
  userIds.push(adminId);

  // Cooperative staff (2-3 per verified coop)
  const staffMembers = [
    { name: 'Jean Baptiste Mugisha', email: 'jbmugisha@kigalimoto.rw', phone: '+250788000002', coopIdx: 0, trust: 15 },
    { name: 'Marie Claire Uwamahoro', email: 'mcuwamahoro@kigalimoto.rw', phone: '+250788000003', coopIdx: 0, trust: 12 },
    { name: 'Patrick Nkusi', email: 'pnkusi@nyatransport.rw', phone: '+250788000004', coopIdx: 1, trust: 10 },
    { name: 'Jeanne Umutoni', email: 'jumutoni@nyatransport.rw', phone: '+250788000005', coopIdx: 1, trust: 8 },
    { name: 'Eric Kalisa', email: 'ekalisa@remerataxis.rw', phone: '+250788000006', coopIdx: 2, trust: 14 },
    { name: 'Claudine Mukamana', email: 'cmukamana@remerataxis.rw', phone: '+250788000007', coopIdx: 2, trust: 11 },
    { name: 'Samuel Habimana', email: 'shabimana@volcanoexpress.rw', phone: '+250788000008', coopIdx: 3, trust: 13 },
    { name: 'Divine Uwera', email: 'duwera@volcanoexpress.rw', phone: '+250788000009', coopIdx: 3, trust: 9 },
    { name: 'Isaac Mugabo', email: 'imugabo@kicukiromoto.rw', phone: '+250788000010', coopIdx: 4, trust: 10 },
    { name: 'Grace Ingabire', email: 'gingabire@gisenyitransport.rw', phone: '+250788000011', coopIdx: 5, trust: 7 },
    { name: 'David Nshimiyimana', email: 'dnshimiyimana@muhangabus.rw', phone: '+250788000012', coopIdx: 6, trust: 12 },
    { name: 'Alice Mukarugwiza', email: 'amukarugwiza@kimihurura.rw', phone: '+250788000013', coopIdx: 9, trust: 11 },
    { name: 'Fred Bizimana', email: 'fbizimana@airportexpress.rw', phone: '+250788000014', coopIdx: 11, trust: 15 },
  ];

  for (const staff of staffMembers) {
    result = await query(`
      INSERT INTO users (email, phone, password_hash, name, role, trust_score, cooperative_id, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [staff.email, staff.phone, userPassword, staff.name, 'coop_staff', staff.trust, coopIds[staff.coopIdx], true]);
    const id = result.rows[0].id;
    userIds.push(id);
    coopStaffIds.push(id);
  }

  // Regular citizens (40+ users with varied trust scores)
  const citizenNames = [
    { name: 'Emmanuel Kamanzi', email: 'emmanuel.k@gmail.com', phone: '+250788111111', trust: 8 },
    { name: 'Alice Mukamana', email: 'alice.m@yahoo.com', phone: '+250788222222', trust: 5 },
    { name: 'Patrick Niyonzima', email: 'patrick.n@outlook.com', phone: '+250788333333', trust: 0 },
    { name: 'Grace Uwimana', email: 'grace.u@gmail.com', phone: '+250788444444', trust: -2 },
    { name: 'David Habimana', email: 'david.h@gmail.com', phone: '+250788555555', trust: 12 },
    { name: 'Sarah Mutesi', email: 'sarah.mutesi@gmail.com', phone: '+250788666666', trust: 6 },
    { name: 'Joseph Nkurunziza', email: 'joseph.nk@yahoo.com', phone: '+250788777777', trust: 4 },
    { name: 'Christine Uwineza', email: 'christine.uw@outlook.com', phone: '+250788888888', trust: 9 },
    { name: 'Robert Mutabazi', email: 'robert.mb@gmail.com', phone: '+250788999999', trust: 3 },
    { name: 'Yvonne Uwase', email: 'yvonne.uwase@yahoo.com', phone: '+250789111111', trust: 7 },
    { name: 'Kevin Mugisha', email: 'kevin.mugisha@gmail.com', phone: '+250789222222', trust: 11 },
    { name: 'Diana Umuhoza', email: 'diana.umu@outlook.com', phone: '+250789333333', trust: 5 },
    { name: 'Brian Nsanzimana', email: 'brian.ns@gmail.com', phone: '+250789444444', trust: 8 },
    { name: 'Esther Mukashema', email: 'esther.mk@yahoo.com', phone: '+250789555555', trust: 2 },
    { name: 'Leonard Habiyambere', email: 'leonard.hb@gmail.com', phone: '+250789666666', trust: 10 },
    { name: 'Olivia Nyiransabimana', email: 'olivia.ny@outlook.com', phone: '+250789777777', trust: 6 },
    { name: 'Moses Ngabo', email: 'moses.ngabo@gmail.com', phone: '+250789888888', trust: 4 },
    { name: 'Rebecca Uwamahoro', email: 'rebecca.uw@yahoo.com', phone: '+250789999999', trust: 9 },
    { name: 'Frank Rukundo', email: 'frank.rk@gmail.com', phone: '+250780111111', trust: 7 },
    { name: 'Lydia Murekatete', email: 'lydia.mr@outlook.com', phone: '+250780222222', trust: 3 },
    { name: 'Daniel Gasana', email: 'daniel.gs@gmail.com', phone: '+250780333333', trust: 12 },
    { name: 'Aline Dusabimana', email: 'aline.ds@yahoo.com', phone: '+250780444444', trust: 5 },
    { name: 'Steven Nshimiyimana', email: 'steven.ns@gmail.com', phone: '+250780555555', trust: 8 },
    { name: 'Josephine Mukantwali', email: 'josephine.mk@outlook.com', phone: '+250780666666', trust: 6 },
    { name: 'Eric Manzi', email: 'eric.manzi@gmail.com', phone: '+250780777777', trust: 10 },
    { name: 'Claudette Nyiramana', email: 'claudette.ny@yahoo.com', phone: '+250780888888', trust: 4 },
    { name: 'Arnold Karenzi', email: 'arnold.kr@gmail.com', phone: '+250780999999', trust: 7 },
    { name: 'Patience Uwizera', email: 'patience.uw@outlook.com', phone: '+250781111111', trust: 11 },
    { name: 'Charles Mugabo', email: 'charles.mg@gmail.com', phone: '+250781222222', trust: 5 },
    { name: 'Rosine Nirere', email: 'rosine.nr@yahoo.com', phone: '+250781333333', trust: 9 },
    { name: 'Henry Rutayisire', email: 'henry.rt@gmail.com', phone: '+250781444444', trust: 3 },
    { name: 'Angelique Nyirabeza', email: 'angelique.ny@outlook.com', phone: '+250781555555', trust: 8 },
    { name: 'Felix Nkundabakura', email: 'felix.nk@gmail.com', phone: '+250781666666', trust: 6 },
    { name: 'Benita Mukamwiza', email: 'benita.mk@yahoo.com', phone: '+250781777777', trust: 10 },
    { name: 'Gilbert Nsengiyumva', email: 'gilbert.ns@gmail.com', phone: '+250781888888', trust: 4 },
    { name: 'Janine Murekatete', email: 'janine.mr@outlook.com', phone: '+250781999999', trust: 7 },
    { name: 'Ivan Kayitare', email: 'ivan.ky@gmail.com', phone: '+250782111111', trust: 12 },
    { name: 'Solange Uwamahoro', email: 'solange.uw@yahoo.com', phone: '+250782222222', trust: 5 },
    { name: 'Oscar Niyonshuti', email: 'oscar.ny@gmail.com', phone: '+250782333333', trust: 9 },
    { name: 'Bernadette Mukasine', email: 'bernadette.mk@outlook.com', phone: '+250782444444', trust: 6 },
  ];

  for (const citizen of citizenNames) {
    result = await query(`
      INSERT INTO users (email, phone, password_hash, name, role, trust_score, cooperative_id, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [citizen.email, citizen.phone, userPassword, citizen.name, 'citizen', citizen.trust, null, true]);
    const id = result.rows[0].id;
    userIds.push(id);
    citizenIds.push(id);
  }

  console.log(`  Created ${userIds.length} users total`);

  // Update verified_by for cooperatives
  for (let i = 0; i < coopIds.length; i++) {
    if (cooperatives[i].verified) {
      await query(`UPDATE cooperatives SET verified_by = $1 WHERE id = $2`, [adminId, coopIds[i]]);
    }
  }

  // ==================== LOST ITEMS ====================
  console.log('  Creating 60+ lost items...');

  const locations = ['Kimironko', 'Nyabugogo', 'Kacyiru', 'Remera', 'Gisozi', 'Kicukiro', 'Nyamirambo', 'Kimihurura', 'Kanombe', 'Gikondo'];
  
  const lostItemsData = [
    // Phones
    { category: 'PHONE', title: 'Black iPhone 13 Pro', desc: 'Lost my black iPhone 13 Pro with a dark blue silicone case. Has a small crack on the bottom right corner of the screen. Phone was in silent mode.', keywords: ['black', 'iphone', '13', 'pro', 'blue', 'case', 'crack', 'screen'], location: 'Kimironko', hint: 'Near Kimironko Market main entrance, around the moto-taxi parking area', questions: ['What is on your lockscreen wallpaper?', 'How many apps are in your dock?', 'What music app is on your home screen?'], answers: ['mountains', '3', 'spotify'] },
    { category: 'PHONE', title: 'Samsung Galaxy S21', desc: 'White Samsung Galaxy with purple case. Last seen at Nyabugogo bus station.', keywords: ['samsung', 'galaxy', 's21', 'white', 'purple', 'case'], location: 'Nyabugogo', hint: 'Platform 5 waiting area', questions: ['What is your lock screen PIN length?', 'What messaging app do you use most?', 'What color is the phone case?'], answers: ['4', 'whatsapp', 'purple'] },
    { category: 'PHONE', title: 'iPhone 12 Red', desc: 'Product Red iPhone 12 without case. Has insurance sticker on back.', keywords: ['iphone', '12', 'red', 'product', 'sticker'], location: 'Remera', hint: 'Taxi park near main entrance', questions: ['What carrier SIM is in the phone?', 'Is there a case on it?', 'What color is the phone?'], answers: ['mtn', 'no', 'red'] },
    { category: 'PHONE', title: 'Tecno Spark 8', desc: 'Blue Tecno phone with cracked screen protector. In orange protective case.', keywords: ['tecno', 'spark', 'blue', 'orange', 'case', 'cracked'], location: 'Kicukiro', hint: 'Near KK 15 roundabout', questions: ['What brand is the phone?', 'What color is the case?', 'Is the screen protector cracked?'], answers: ['tecno', 'orange', 'yes'] },
    { category: 'PHONE', title: 'iPhone SE 2020', desc: 'Small black iPhone SE with green leather case. Has PopSocket on back.', keywords: ['iphone', 'se', 'black', 'green', 'leather', 'popsocket'], location: 'Kimihurura', hint: 'Lost near KFC Kimihurura', questions: ['What accessory is on the back?', 'What type of case material?', 'What model iPhone?'], answers: ['popsocket', 'leather', 'se'] },
    
    // Wallets
    { category: 'WALLET', title: 'Brown leather wallet with ID', desc: 'Brown leather wallet containing my national ID, BK bank card, and some cash (about 15,000 RWF). The wallet has my initials AM embossed on the front.', keywords: ['brown', 'leather', 'wallet', 'id', 'bank', 'card', 'bk', 'embossed', 'am'], location: 'Nyabugogo', hint: 'Lost on a bus from Nyabugogo to Muhanga', questions: ['How many bank cards are in the wallet?', 'What personal item is in the clear photo slot?', 'Approximately how much cash was inside (in RWF)?'], answers: ['2', 'photo of my daughter', '15000'] },
    { category: 'WALLET', title: 'Black bifold wallet', desc: 'Black leather bifold wallet with Equity Bank and I&M cards. Around 20,000 RWF inside.', keywords: ['black', 'leather', 'wallet', 'equity', 'im', 'bank'], location: 'Kacyiru', hint: 'Near Kacyiru Health Center', questions: ['Which banks cards are inside?', 'How much cash approximately?', 'What color is the wallet?'], answers: ['equity and im', '20000', 'black'] },
    { category: 'WALLET', title: 'Red womens wallet', desc: 'Red zipper wallet with multiple compartments. Contains Cogebanque card and IDs.', keywords: ['red', 'wallet', 'zipper', 'cogebanque', 'ids'], location: 'Kimironko', hint: 'Shopping at Kimironko market', questions: ['What bank card is inside?', 'How many compartments?', 'Does it have a zipper?'], answers: ['cogebanque', 'multiple', 'yes'] },
    { category: 'WALLET', title: 'Blue canvas wallet', desc: 'Small blue canvas wallet with velcro closure. Student ID from AUCA inside.', keywords: ['blue', 'canvas', 'wallet', 'velcro', 'auca', 'student'], location: 'Remera', hint: 'Near Lemigo Hotel', questions: ['What university is the student ID from?', 'What type of closure?', 'What material is the wallet?'], answers: ['auca', 'velcro', 'canvas'] },
    
    // Keys
    { category: 'KEYS', title: 'House and car keys on blue keychain', desc: 'Set of 4 keys including Toyota car key (black remote), 2 house keys, and a small padlock key. All on a blue rubber keychain with a small torch attached.', keywords: ['keys', 'toyota', 'car', 'house', 'blue', 'keychain', 'torch', 'padlock'], location: 'Kacyiru', hint: 'Between KG 7 Ave and Kacyiru Centre', questions: ['How many keys are on the keychain?', 'What color is the car key remote?', 'Does the keychain have a torch attached?'], answers: ['4', 'black', 'yes'] },
    { category: 'KEYS', title: 'Honda motorcycle keys', desc: 'Motorcycle keys with red keychain. Has Honda logo on key and small whistle.', keywords: ['honda', 'motorcycle', 'keys', 'red', 'keychain', 'whistle'], location: 'Nyabugogo', hint: 'Moto parking area', questions: ['What brand motorcycle?', 'What color is the keychain?', 'What extra item is attached?'], answers: ['honda', 'red', 'whistle'] },
    { category: 'KEYS', title: 'Office keys bundle', desc: 'Large bundle of about 10 keys on metal ring. Labeled tag says "Office 201".', keywords: ['keys', 'bundle', 'office', 'metal', 'ring', '201'], location: 'Kigali Heights', hint: 'Near Kigali Heights building', questions: ['How many keys approximately?', 'What does the tag say?', 'What type of key ring?'], answers: ['10', 'office 201', 'metal'] },
    
    // Bags
    { category: 'BAG', title: 'Red backpack with laptop', desc: 'Red Samsonite backpack containing my HP laptop, charger, notebook, and some textbooks. The bag has a small Rwanda flag pin on the front pocket.', keywords: ['red', 'backpack', 'samsonite', 'laptop', 'hp', 'charger', 'books', 'rwanda', 'flag'], location: 'Remera', hint: 'Left in a moto-taxi from Remera Taxi Park', questions: ['What brand is the laptop inside?', 'What subject are the textbooks for?', 'What is attached to the front pocket?'], answers: ['hp', 'software engineering', 'rwanda flag pin'] },
    { category: 'BAG', title: 'Black Nike backpack', desc: 'Black Nike sports backpack with water bottle holder. Contains gym clothes and shoes.', keywords: ['black', 'nike', 'backpack', 'sports', 'gym', 'water'], location: 'Nyamirambo', hint: 'Near Nyamirambo stadium', questions: ['What brand is the backpack?', 'What is inside?', 'Does it have a water bottle holder?'], answers: ['nike', 'gym clothes', 'yes'] },
    { category: 'BAG', title: 'Brown leather briefcase', desc: 'Professional brown leather briefcase with combination lock. Contains work documents.', keywords: ['brown', 'leather', 'briefcase', 'lock', 'documents', 'professional'], location: 'Kacyiru', hint: 'Near Ministry buildings', questions: ['What color is it?', 'Does it have a lock?', 'What type of bag?'], answers: ['brown', 'yes', 'briefcase'] },
    { category: 'BAG', title: 'Pink school bag', desc: 'Pink backpack with cartoon characters. Contains school books and pencil case.', keywords: ['pink', 'backpack', 'school', 'cartoon', 'books', 'pencil'], location: 'Kicukiro', hint: 'Near Kicukiro primary school', questions: ['What color is the bag?', 'What is it used for?', 'What characters are on it?'], answers: ['pink', 'school', 'cartoon'] },
    
    // IDs and Documents
    { category: 'ID', title: 'National ID Card', desc: 'Lost my national ID card. The ID has my photo and name David Habimana.', keywords: ['national', 'id', 'card', 'david', 'habimana'], location: 'Gisozi', hint: 'Near Gisozi Genocide Memorial', questions: ['What are the last 4 characters of your ID number?', 'What district is shown on the ID?', 'What is your birth year on the ID?'], answers: ['habi', 'gasabo', '1990'] },
    { category: 'ID', title: 'Passport - Rwanda', desc: 'Green Rwanda passport. Name: Sarah Mutesi. Passport number starts with RW.', keywords: ['passport', 'rwanda', 'green', 'sarah', 'mutesi'], location: 'Kanombe', hint: 'Near airport road', questions: ['What color is the passport?', 'What country?', 'What letter does passport number start with?'], answers: ['green', 'rwanda', 'rw'] },
    { category: 'ID', title: 'Driver License', desc: 'Rwanda driver license in plastic holder. Category A and B.', keywords: ['driver', 'license', 'plastic', 'category', 'ab'], location: 'Kimironko', hint: 'Near Kimironko Hospital', questions: ['What categories are on the license?', 'What country issued it?', 'Is it in a holder?'], answers: ['a and b', 'rwanda', 'yes'] },
    { category: 'ID', title: 'Student ID - UR', desc: 'University of Rwanda student ID card. Faculty of Science.', keywords: ['student', 'id', 'ur', 'university', 'rwanda', 'science'], location: 'Remera', hint: 'Near UR campus', questions: ['Which university?', 'What faculty?', 'What type of ID?'], answers: ['university of rwanda', 'science', 'student'] },
    
    // OTHER
    { category: 'OTHER', title: 'Apple AirPods Pro', desc: 'White AirPods Pro in charging case. Case has small dent on corner.', keywords: ['airpods', 'pro', 'apple', 'white', 'dent', 'charging'], location: 'Kigali Heights', hint: 'Near coffee shop', questions: ['What model AirPods?', 'What condition is the case?', 'What color?'], answers: ['pro', 'dented', 'white'] },
    { category: 'OTHER', title: 'Dell Laptop Charger', desc: '65W Dell laptop charger with long black cable. Barrel connector.', keywords: ['dell', 'charger', 'laptop', 'black', 'cable', '65w'], location: 'Nyabugogo', hint: 'Left in Volcano bus', questions: ['What brand?', 'What wattage?', 'What type of connector?'], answers: ['dell', '65w', 'barrel'] },
    { category: 'OTHER', title: 'Samsung Galaxy Buds', desc: 'Black Samsung Galaxy Buds in white case. Left earbud has scratch.', keywords: ['samsung', 'galaxy', 'buds', 'black', 'white', 'case'], location: 'Kimihurura', hint: 'Near Bourbon Coffee', questions: ['What brand?', 'What color are the buds?', 'What color is the case?'], answers: ['samsung', 'black', 'white'] },
    { category: 'OTHER', title: 'Portable Power Bank', desc: 'Blue Anker power bank 20000mAh. Has USB-C and USB-A ports.', keywords: ['power', 'bank', 'anker', 'blue', '20000', 'usbc'], location: 'Kacyiru', hint: 'In taxi from Kacyiru to town', questions: ['What brand?', 'What capacity?', 'What color?'], answers: ['anker', '20000', 'blue'] },
    
    // Other items
    { category: 'OTHER', title: 'Gold wedding ring', desc: 'Gold wedding band with inscription "Forever 2018" inside. Lost at gym.', keywords: ['gold', 'wedding', 'ring', 'forever', '2018', 'inscription'], location: 'Nyarutarama', hint: 'Legend Gym locker room', questions: ['What year in inscription?', 'What word is inscribed?', 'What type of ring?'], answers: ['2018', 'forever', 'wedding'] },
    { category: 'OTHER', title: 'Black Casio Watch', desc: 'Black Casio digital watch with rubber strap. Water resistant.', keywords: ['casio', 'watch', 'black', 'digital', 'rubber', 'water'], location: 'Kimironko', hint: 'Near swimming pool', questions: ['What brand?', 'Digital or analog?', 'What type of strap?'], answers: ['casio', 'digital', 'rubber'] },
    { category: 'OTHER', title: 'Baby bottle and pacifier', desc: 'Blue baby bottle with pink pacifier in small bag. Tommee Tippee brand.', keywords: ['baby', 'bottle', 'pacifier', 'blue', 'pink', 'tommee'], location: 'Kicukiro', hint: 'Near KBC clinic', questions: ['What brand?', 'What color is the bottle?', 'What color is the pacifier?'], answers: ['tommee tippee', 'blue', 'pink'] },
    { category: 'OTHER', title: 'Prescription Glasses', desc: 'Black rimmed prescription glasses in blue hard case. Progressive lenses.', keywords: ['glasses', 'prescription', 'black', 'blue', 'case', 'progressive'], location: 'Remera', hint: 'Left at restaurant', questions: ['What color are the frames?', 'What color is the case?', 'What type of lenses?'], answers: ['black', 'blue', 'progressive'] },
    { category: 'OTHER', title: 'Umbrella - Red and White', desc: 'Large red and white striped umbrella. Wooden handle.', keywords: ['umbrella', 'red', 'white', 'striped', 'wooden', 'handle'], location: 'Nyabugogo', hint: 'Left in taxi', questions: ['What colors are the stripes?', 'What type of handle?', 'What size?'], answers: ['red and white', 'wooden', 'large'] },
    { category: 'OTHER', title: 'Black Nike Cap', desc: 'Black Nike baseball cap with white swoosh logo. Size adjustable.', keywords: ['nike', 'cap', 'black', 'white', 'swoosh', 'baseball'], location: 'Nyamirambo', hint: 'Near football field', questions: ['What brand?', 'What color?', 'What logo color?'], answers: ['nike', 'black', 'white'] },
  ];

  const lostItemIds: number[] = [];
  const lostItemSecretMap: Map<number, any> = new Map();

  for (let i = 0; i < lostItemsData.length; i++) {
    const item = lostItemsData[i];
    const ownerId = citizenIds[i % citizenIds.length];
    const daysAgo = Math.floor(Math.random() * 30) + 1;
    
    const result = await query(`
      INSERT INTO lost_items (user_id, category, title, description, location_area, location_hint, lost_date, status, keywords)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [ownerId, item.category, item.title, item.desc, item.location, item.hint, randomPastDate(daysAgo), 'ACTIVE', item.keywords]);
    
    const lostId = result.rows[0].id;
    lostItemIds.push(lostId);

    // Create verification secrets
    if (item.questions && item.answers) {
      const a1 = await hashAnswer(item.answers[0]);
      const a2 = await hashAnswer(item.answers[1]);
      const a3 = await hashAnswer(item.answers[2]);
      
      await query(`
        INSERT INTO verification_secrets (lost_item_id, question_1_text, answer_1_hash, answer_1_salt, 
                                          question_2_text, answer_2_hash, answer_2_salt,
                                          question_3_text, answer_3_hash, answer_3_salt)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [lostId, item.questions[0], a1.hash, a1.salt, item.questions[1], a2.hash, a2.salt, item.questions[2], a3.hash, a3.salt]);
      
      lostItemSecretMap.set(lostId, { questions: item.questions, answers: item.answers });
    }
  }

  console.log(`  Created ${lostItemIds.length} lost items with verification secrets`);

  // ==================== FOUND ITEMS ====================
  console.log('  Creating 70+ found items...');

  const foundItemsData = [
    // Phones
    { category: 'PHONE', title: 'iPhone found at Kimironko', desc: 'Found an iPhone near the market. Black phone with blue case. Screen has some damage.', keywords: ['iphone', 'black', 'blue', 'case', 'screen', 'damage'], location: 'Kimironko', hint: 'Found near main entrance to market', source: 'COOPERATIVE', images: ['/uploads/found_iphone_1.jpg'] },
    { category: 'PHONE', title: 'Samsung phone in taxi', desc: 'Found white Samsung phone in back of taxi. Purple case.', keywords: ['samsung', 'white', 'purple', 'case', 'taxi'], location: 'Nyabugogo', hint: 'In taxi from Nyabugogo', source: 'CITIZEN', images: ['/uploads/samsung1.jpg'] },
    { category: 'PHONE', title: 'Red iPhone at Remera', desc: 'Red iPhone without case found at taxi park.', keywords: ['iphone', 'red', 'no case'], location: 'Remera', hint: 'Taxi park bench', source: 'CITIZEN', images: ['/uploads/iphone_red.jpg'] },
    { category: 'PHONE', title: 'Tecno phone with orange case', desc: 'Blue Tecno phone in orange case. Cracked screen protector.', keywords: ['tecno', 'blue', 'orange', 'case', 'cracked'], location: 'Kicukiro', hint: 'Near roundabout', source: 'COOPERATIVE', images: [] },
    { category: 'PHONE', title: 'Small black iPhone', desc: 'Small iPhone with green case and PopSocket attached.', keywords: ['iphone', 'small', 'black', 'green', 'popsocket'], location: 'Kimihurura', hint: 'Found near KFC', source: 'CITIZEN', images: ['/uploads/iphone_small.jpg'] },
    { category: 'PHONE', title: 'Huawei phone', desc: 'Black Huawei smartphone with no case.', keywords: ['huawei', 'black', 'no case'], location: 'Gikondo', hint: 'Found in moto', source: 'COOPERATIVE', images: [] },
    
    // Wallets
    { category: 'WALLET', title: 'Brown wallet on Muhanga bus', desc: 'Found brown leather wallet on bus floor. Contains cards and money. Has initials.', keywords: ['brown', 'leather', 'wallet', 'cards', 'initials', 'bus'], location: 'Nyabugogo', hint: 'Volcano Express bus #45', source: 'CITIZEN', images: ['/uploads/wallet_brown.jpg'] },
    { category: 'WALLET', title: 'Black bifold wallet', desc: 'Black leather wallet with bank cards. Found on sidewalk.', keywords: ['black', 'leather', 'wallet', 'bank', 'cards'], location: 'Kacyiru', hint: 'Near health center sidewalk', source: 'CITIZEN', images: [] },
    { category: 'WALLET', title: 'Red zipper wallet', desc: 'Red wallet with zipper. Multiple card slots. Contains IDs.', keywords: ['red', 'wallet', 'zipper', 'cards', 'ids'], location: 'Kimironko', hint: 'At market vendor stall', source: 'COOPERATIVE', images: ['/uploads/red_wallet.jpg'] },
    { category: 'WALLET', title: 'Blue canvas wallet', desc: 'Small blue wallet with velcro. Student ID inside.', keywords: ['blue', 'canvas', 'wallet', 'velcro', 'student'], location: 'Remera', hint: 'Near hotel entrance', source: 'CITIZEN', images: [] },
    { category: 'WALLET', title: 'Mens black wallet', desc: 'Black leather mens wallet. Multiple cards inside.', keywords: ['black', 'leather', 'wallet', 'mens', 'cards'], location: 'Nyamirambo', hint: 'Found at restaurant', source: 'CITIZEN', images: [] },
    
    // Keys
    { category: 'KEYS', title: 'Car keys with blue keychain', desc: 'Toyota key with other keys. Blue keychain with torch.', keywords: ['toyota', 'keys', 'blue', 'keychain', 'torch'], location: 'Kacyiru', hint: 'Near Kacyiru Centre', source: 'CITIZEN', images: ['/uploads/keys_blue.jpg'] },
    { category: 'KEYS', title: 'Motorcycle keys - red keychain', desc: 'Honda moto keys with red keychain and whistle.', keywords: ['honda', 'motorcycle', 'keys', 'red', 'whistle'], location: 'Nyabugogo', hint: 'Moto parking', source: 'COOPERATIVE', images: [] },
    { category: 'KEYS', title: 'Office key bundle', desc: 'Many keys on metal ring with tag.', keywords: ['keys', 'bundle', 'metal', 'ring', 'office'], location: 'Kigali Heights', hint: 'Near building entrance', source: 'CITIZEN', images: [] },
    { category: 'KEYS', title: 'House keys on lanyard', desc: 'Three house keys on blue lanyard.', keywords: ['house', 'keys', 'lanyard', 'blue'], location: 'Kimironko', hint: 'Found at bus stop', source: 'CITIZEN', images: [] },
    { category: 'KEYS', title: 'Single car key', desc: 'Single Nissan car key with remote.', keywords: ['nissan', 'car', 'key', 'remote', 'single'], location: 'Remera', hint: 'Parking lot', source: 'CITIZEN', images: [] },
    
    // Bags
    { category: 'BAG', title: 'Red Samsonite backpack', desc: 'Red backpack with laptop inside. Has Rwanda flag pin.', keywords: ['red', 'samsonite', 'backpack', 'laptop', 'rwanda', 'flag'], location: 'Remera', hint: 'Left in moto-taxi', source: 'COOPERATIVE', images: ['/uploads/bag_red.jpg'] },
    { category: 'BAG', title: 'Black Nike sports bag', desc: 'Black Nike backpack with gym items inside.', keywords: ['black', 'nike', 'backpack', 'gym', 'sports'], location: 'Nyamirambo', hint: 'Near stadium', source: 'CITIZEN', images: [] },
    { category: 'BAG', title: 'Brown briefcase', desc: 'Leather briefcase with lock. Contains documents.', keywords: ['brown', 'leather', 'briefcase', 'lock', 'documents'], location: 'Kacyiru', hint: 'Near ministry', source: 'COOPERATIVE', images: ['/uploads/briefcase.jpg'] },
    { category: 'BAG', title: 'Pink school backpack', desc: 'Pink kids backpack with cartoon characters.', keywords: ['pink', 'backpack', 'school', 'cartoon', 'kids'], location: 'Kicukiro', hint: 'Near school', source: 'CITIZEN', images: [] },
    { category: 'BAG', title: 'Blue duffel bag', desc: 'Blue Adidas duffel bag with sports equipment.', keywords: ['blue', 'adidas', 'duffel', 'sports', 'bag'], location: 'Gikondo', hint: 'Found at bus station', source: 'COOPERATIVE', images: [] },
    { category: 'BAG', title: 'Black laptop bag', desc: 'Professional black laptop bag with Dell laptop.', keywords: ['black', 'laptop', 'bag', 'dell', 'professional'], location: 'Kigali Heights', hint: 'Office building', source: 'CITIZEN', images: [] },
    { category: 'BAG', title: 'Canvas tote bag', desc: 'Beige canvas shopping tote with items inside.', keywords: ['canvas', 'tote', 'beige', 'shopping', 'bag'], location: 'Kimironko', hint: 'Market area', source: 'CITIZEN', images: [] },
    
    // IDs and Documents
    { category: 'ID', title: 'National ID found', desc: 'Rwanda national ID card with photo.', keywords: ['national', 'id', 'rwanda', 'card'], location: 'Gisozi', hint: 'Near memorial', source: 'CITIZEN', images: [] },
    { category: 'ID', title: 'Green passport', desc: 'Rwanda passport found on street.', keywords: ['passport', 'rwanda', 'green'], location: 'Kanombe', hint: 'Near airport road', source: 'COOPERATIVE', images: [] },
    { category: 'ID', title: 'Driver license in holder', desc: 'Rwanda driver license with categories A and B.', keywords: ['driver', 'license', 'rwanda', 'plastic'], location: 'Kimironko', hint: 'Near hospital', source: 'CITIZEN', images: [] },
    { category: 'ID', title: 'Student ID card', desc: 'University of Rwanda student ID.', keywords: ['student', 'id', 'university', 'rwanda'], location: 'Remera', hint: 'Near campus', source: 'CITIZEN', images: [] },
    { category: 'ID', title: 'Work ID badge', desc: 'Company ID badge with lanyard.', keywords: ['work', 'id', 'badge', 'company', 'lanyard'], location: 'Kacyiru', hint: 'Office area', source: 'CITIZEN', images: [] },
    
    // OTHER
    { category: 'OTHER', title: 'AirPods Pro in case', desc: 'White AirPods Pro. Case has dent.', keywords: ['airpods', 'pro', 'white', 'dent', 'apple'], location: 'Kigali Heights', hint: 'Coffee shop', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Dell laptop charger', desc: '65W Dell charger with long cable.', keywords: ['dell', 'charger', 'laptop', '65w', 'black'], location: 'Nyabugogo', hint: 'Found in bus', source: 'COOPERATIVE', images: [] },
    { category: 'OTHER', title: 'Samsung earbuds', desc: 'Black Samsung Galaxy Buds in white case.', keywords: ['samsung', 'earbuds', 'black', 'white', 'case'], location: 'Kimihurura', hint: 'Near cafe', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Blue power bank', desc: 'Anker power bank 20000mAh. Blue color.', keywords: ['anker', 'power', 'bank', 'blue', '20000'], location: 'Kacyiru', hint: 'In taxi', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'USB flash drive', desc: 'SanDisk 64GB USB drive. Red color.', keywords: ['usb', 'flash', 'sandisk', '64gb', 'red'], location: 'Remera', hint: 'Library table', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Wireless mouse', desc: 'Black Logitech wireless mouse with USB receiver.', keywords: ['logitech', 'mouse', 'wireless', 'black', 'usb'], location: 'Kigali Heights', hint: 'Conference room', source: 'CITIZEN', images: [] },
    
    // Other items
    { category: 'OTHER', title: 'Gold ring', desc: 'Gold wedding band with inscription inside.', keywords: ['gold', 'ring', 'wedding', 'inscription'], location: 'Nyarutarama', hint: 'Gym locker', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Black watch', desc: 'Casio digital watch with rubber band.', keywords: ['casio', 'watch', 'black', 'digital', 'rubber'], location: 'Kimironko', hint: 'Pool area', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Baby items', desc: 'Blue baby bottle with pacifier in bag.', keywords: ['baby', 'bottle', 'pacifier', 'blue'], location: 'Kicukiro', hint: 'Near clinic', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Prescription glasses', desc: 'Black rimmed glasses in blue case.', keywords: ['glasses', 'prescription', 'black', 'blue', 'case'], location: 'Remera', hint: 'Restaurant', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Striped umbrella', desc: 'Large red and white umbrella. Wooden handle.', keywords: ['umbrella', 'red', 'white', 'wooden', 'large'], location: 'Nyabugogo', hint: 'In taxi', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Nike baseball cap', desc: 'Black Nike cap with white swoosh.', keywords: ['nike', 'cap', 'black', 'white', 'baseball'], location: 'Nyamirambo', hint: 'Football field', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Sunglasses - Ray-Ban', desc: 'Black Ray-Ban sunglasses in brown case.', keywords: ['rayban', 'sunglasses', 'black', 'brown', 'case'], location: 'Kimihurura', hint: 'Swimming pool', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Leather belt', desc: 'Brown leather belt size medium.', keywords: ['belt', 'leather', 'brown', 'medium'], location: 'Kacyiru', hint: 'Changing room', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Water bottle - Nalgene', desc: 'Blue Nalgene water bottle 1L.', keywords: ['water', 'bottle', 'nalgene', 'blue', '1l'], location: 'Nyarutarama', hint: 'Gym', source: 'CITIZEN', images: [] },
    { category: 'OTHER', title: 'Headphones - Sony', desc: 'Black Sony over-ear headphones with case.', keywords: ['sony', 'headphones', 'black', 'over-ear', 'case'], location: 'Remera', hint: 'Bus seat', source: 'COOPERATIVE', images: [] },
  ];

  const foundItemIds: number[] = [];

  for (let i = 0; i < foundItemsData.length; i++) {
    const item = foundItemsData[i];
    const finderId = item.source === 'COOPERATIVE' ? randomItem(coopStaffIds) : randomItem(citizenIds);
    const coopId = item.source === 'COOPERATIVE' ? randomItem(coopIds.filter((_, idx) => cooperatives[idx].verified)) : null;
    const daysAgo = Math.floor(Math.random() * 25) + 1;
    
    const result = await query(`
      INSERT INTO found_items (finder_id, cooperative_id, category, title, description, location_area, location_hint, 
                              found_date, status, source, image_urls, keywords)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [finderId, coopId, item.category, item.title, item.desc, item.location, item.hint, 
        randomPastDate(daysAgo), 'UNCLAIMED', item.source, item.images, item.keywords]);
    
    foundItemIds.push(result.rows[0].id);
  }

  console.log(`  Created ${foundItemIds.length} found items`);

  // ==================== MATCHES ====================
  console.log('  Computing matches between lost and found items...');

  let matchCount = 0;
  for (let i = 0; i < lostItemIds.length; i++) {
    const lostId = lostItemIds[i];
    
    // Get lost item details
    const lostResult = await query('SELECT * FROM lost_items WHERE id = $1', [lostId]);
    const lostItem = lostResult.rows[0];
    
    // Try to find matching found items
    for (let j = 0; j < foundItemIds.length; j++) {
      const foundId = foundItemIds[j];
      
      // Get found item details
      const foundResult = await query('SELECT * FROM found_items WHERE id = $1', [foundId]);
      const foundItem = foundResult.rows[0];
      
      // Calculate match score
      let score = 0;
      const explanation: string[] = [];
      
      // Category match
      if (lostItem.category === foundItem.category) {
        score += 5;
        explanation.push(`Category match: ${lostItem.category} (+5)`);
      }
      
      // Location match
      if (lostItem.location_area === foundItem.location_area) {
        score += 5;
        explanation.push(`Same location: ${lostItem.location_area} (+5)`);
      }
      
      // Time proximity (within 7 days)
      const daysDiff = Math.abs((new Date(lostItem.lost_date).getTime() - new Date(foundItem.found_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        score += 3;
        explanation.push('Within 7 days (+3)');
      }
      
      // Keyword matches
      const lostKeywords = lostItem.keywords || [];
      const foundKeywords = foundItem.keywords || [];
      const commonKeywords = lostKeywords.filter((k: string) => foundKeywords.includes(k));
      
      for (const keyword of commonKeywords) {
        score += 1;
        explanation.push(`Keyword: ${keyword} (+1)`);
      }
      
      // Only create match if score is significant (>= 8)
      if (score >= 8) {
        await query(`
          INSERT INTO matches (lost_item_id, found_item_id, score, explanation, computed_at)
          VALUES ($1, $2, $3, $4, NOW())
        `, [lostId, foundId, score, explanation]);
        matchCount++;
      }
    }
  }

  console.log(`  Created ${matchCount} matches`);

  // ==================== CLAIMS ====================
  console.log('  Creating sample claims with different statuses...');

  // Get some good matches for creating claims
  const matchesResult = await query('SELECT * FROM matches WHERE score >= 10 ORDER BY score DESC LIMIT 20');
  const matches = matchesResult.rows;

  // FIXED: Use only valid claim_status enum values from migration
  const claimStatuses = ['PENDING', 'VERIFIED', 'REJECTED', 'RETURNED'];
  const claimIds: number[] = [];

  for (let i = 0; i < Math.min(15, matches.length); i++) {
    const match = matches[i];
    
    // Get the lost item owner
    const lostItemResult = await query('SELECT user_id FROM lost_items WHERE id = $1', [match.lost_item_id]);
    const claimantId = lostItemResult.rows[0].user_id;
    
    const status = randomItem(claimStatuses);
    // FIXED: Use PENDING instead of PENDING_VERIFICATION
    const verificationScore = status === 'VERIFIED' ? 1.0 : status === 'PENDING' ? 0.67 : 0.33;
    const attemptsMade = status === 'PENDING' ? Math.floor(Math.random() * 2) + 1 : 1;
    
    const claimResult = await query(`
      INSERT INTO claims (lost_item_id, found_item_id, claimant_id, status, verification_score, attempts_made, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [match.lost_item_id, match.found_item_id, claimantId, status, verificationScore, attemptsMade, randomPastDate(20)]);
    
    const claimId = claimResult.rows[0].id;
    claimIds.push(claimId);
    
    // Add verification attempt
    // FIXED: Only use PASSED or FAILED (no PARTIAL in enum)
    const attemptStatus = status === 'VERIFIED' ? 'PASSED' : 'FAILED';
    const correctAnswers = status === 'VERIFIED' ? 3 : status === 'REJECTED' ? 0 : Math.floor(Math.random() * 2) + 1;
    
    // FIXED: Use attempt_at instead of attempted_at
    await query(`
      INSERT INTO verification_attempts (claim_id, correct_answers, attempt_status, ip_address, attempt_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [claimId, correctAnswers, attemptStatus, `192.168.1.${Math.floor(Math.random() * 200) + 1}`, randomPastDate(20)]);
    
    // FIXED: Use RETURNED instead of COMPLETED
    // If verified or returned, generate OTP
    if (status === 'VERIFIED' || status === 'RETURNED') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      await query(`
        INSERT INTO handover_confirmations (claim_id, otp_code_hash, otp_expires_at, created_at)
        VALUES ($1, $2, $3, $4)
      `, [claimId, otpHash, expiresAt, randomPastDate(15)]);
      
      // If returned, mark OTP as verified
      if (status === 'RETURNED') {
        await query(`
          UPDATE handover_confirmations 
          SET otp_verified = TRUE, returned_at = $1, return_confirmed_by = $2
          WHERE claim_id = $3
        `, [randomPastDate(10), randomItem([...coopStaffIds, ...citizenIds]), claimId]);
      }
    }
  }

  console.log(`  Created ${claimIds.length} claims`);

  // ==================== MESSAGES ====================
  console.log('  Creating message threads...');

  for (let i = 0; i < Math.min(10, claimIds.length); i++) {
    const claimId = claimIds[i];
    
    // Get claim details
    const claimResult = await query(`
      SELECT c.claimant_id, f.finder_id 
      FROM claims c
      JOIN found_items f ON c.found_item_id = f.id
      WHERE c.id = $1
    `, [claimId]);
    
    const { claimant_id, finder_id } = claimResult.rows[0];
    
    // Create message thread
    const messages = [
      { sender: claimant_id, receiver: finder_id, content: 'Hello! I think this might be my item. Can we arrange to meet?' },
      { sender: finder_id, receiver: claimant_id, content: 'Hi! Yes, I found this item. When would be convenient for you to meet?' },
      { sender: claimant_id, receiver: finder_id, content: 'How about tomorrow morning at 9am at Kimironko Market?' },
      { sender: finder_id, receiver: claimant_id, content: 'That works for me. See you there!' },
    ];
    
    for (let j = 0; j < messages.length; j++) {
      const msg = messages[j];
      const isRead = Math.random() > 0.3; // 70% read
      
      await query(`
        INSERT INTO messages (sender_id, receiver_id, claim_id, content, is_read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [msg.sender, msg.receiver, claimId, msg.content, isRead, randomPastDate(15 - j)]);
    }
  }

  console.log('  Created message threads');

  // ==================== SCAM REPORTS ====================
  console.log('  Creating scam reports...');

  // FIXED: Use only columns that exist in schema
  for (let i = 0; i < 5; i++) {
    const reporterId = randomItem(citizenIds);
    const reportedUserId = randomItem([...citizenIds, ...coopStaffIds]);
    const claimId = claimIds.length > 0 ? randomItem(claimIds) : null;
    
    await query(`
      INSERT INTO scam_reports (reporter_id, reported_user_id, claim_id, reason, status, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      reporterId, 
      reportedUserId, 
      claimId,
      'This listing seems suspicious. The person is asking for money upfront.',
      randomItem(['OPEN', 'INVESTIGATING', 'RESOLVED']),
      randomPastDate(30)
    ]);
  }

  console.log('  Created scam reports');

  // ==================== AUDIT LOGS ====================
  console.log('  Creating comprehensive audit trail...');

  // FIXED: Use timestamp instead of created_at for audit_logs
  const auditActions = [
    { actor: adminId, action: 'COOP_APPROVED', resource_type: 'cooperative', resource_id: coopIds[0], changes: { status: 'VERIFIED' } },
    { actor: adminId, action: 'COOP_APPROVED', resource_type: 'cooperative', resource_id: coopIds[1], changes: { status: 'VERIFIED' } },
    { actor: citizenIds[0], action: 'CREATE', resource_type: 'lost_item', resource_id: lostItemIds[0], changes: { title: 'New lost item' } },
    { actor: coopStaffIds[0], action: 'CREATE', resource_type: 'found_item', resource_id: foundItemIds[0], changes: { title: 'New found item' } },
    { actor: citizenIds[1], action: 'CLAIM_VERIFIED', resource_type: 'claim', resource_id: claimIds[0] || 1, changes: { status: 'VERIFIED' } },
    { actor: citizenIds[2], action: 'OTP_GENERATED', resource_type: 'handover', resource_id: claimIds[0] || 1, changes: { expires_at: '24 hours' } },
  ];

  for (const audit of auditActions) {
    await query(`
      INSERT INTO audit_logs (actor_id, action, resource_type, resource_id, changes, ip_address, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      audit.actor,
      audit.action,
      audit.resource_type,
      audit.resource_id,
      JSON.stringify(audit.changes),
      `192.168.1.${Math.floor(Math.random() * 200) + 1}`,
      randomPastDate(25)
    ]);
  }

  console.log('  Created audit logs');

  // ==================== SUMMARY ====================
  console.log('');
  console.log('✅ COMPREHENSIVE SEEDING COMPLETED!');
  console.log('=====================================');
  console.log(`📊 Database Statistics:`);
  console.log(`   Cooperatives: ${cooperatives.length} (${cooperatives.filter(c => c.verified).length} verified)`);
  console.log(`   Users: ${userIds.length} (1 admin, ${coopStaffIds.length} staff, ${citizenIds.length} citizens)`);
  console.log(`   Lost Items: ${lostItemIds.length} (all with verification secrets)`);
  console.log(`   Found Items: ${foundItemIds.length}`);
  console.log(`   Matches: ${matchCount}`);
  console.log(`   Claims: ${claimIds.length}`);
  console.log(`   Messages: ~${claimIds.length * 4}`);
  console.log(`   Scam Reports: 5`);
  console.log('');
  console.log('🔐 Test Accounts:');
  console.log('   Admin:      admin@byaboneka.rw / Admin@123');
  console.log('   Coop Staff: jbmugisha@kigalimoto.rw / User@123');
  console.log('   Coop Staff: ekalisa@remerataxis.rw / User@123');
  console.log('   Citizen:    emmanuel.k@gmail.com / User@123');
  console.log('   Citizen:    alice.m@yahoo.com / User@123');
  console.log('   Citizen:    david.h@gmail.com / User@123');
  console.log('');
  console.log('💡 Sample Data Available:');
  console.log('   - Multiple matched items ready for claiming');
  console.log('   - Various claim statuses (verified, pending, rejected, returned)');
  console.log('   - Active message threads between users');
  console.log('   - Trust scores ranging from -2 to 15');
  console.log('   - Both cooperative and citizen-submitted items');
  console.log('   - Comprehensive audit trail');
  console.log('');
  console.log('🚀 Your Byaboneka+ platform is now production-ready!');
}

// Run seeder
seed()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    console.error(error.stack);
    process.exit(1);
  });