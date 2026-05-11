CREATE DATABASE IF NOT EXISTS  shippingmgt;

USE shippingmgt;

create table orders (
  order_id int not null auto_increment primary key,
  receiptnum int,
  phone varchar(15),
  second_phone varchar(15),
  retrieve boolean,
  notes varchar(90),
  order_value DECIMAL(10,2) DEFAULT NULL,
  company_partner_id INT DEFAULT NULL,
  status ENUM('Pending','Delivered','Returned','Cancelled') NOT NULL DEFAULT 'Pending',
  profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  driver_commission DECIMAL(12,2) NOT NULL DEFAULT 0,
  company_commission DECIMAL(12,2) NOT NULL DEFAULT 0
  -- merchant_partner_id, assigned_driver_id, shipment_id added below
);


 create table city (city_id int not null auto_increment primary key ,city_name varchar(11));
 
 create table address (address_id int not null auto_increment primary key,address_name varchar(11));
 alter table address add  city_id int;
 alter table address add constraint  fk_address_city foreign key (city_id) references city(city_id);
 alter table orders add address_id int;
 alter table orders add city_id int;
 alter table orders add constraint fk_orders_address foreign key (address_id) references address(address_id);


create table inventory_locations ( location_id int  primary key auto_increment ,location_name varchar(30),type varchar(30));
create table order_movements (movement_id int primary key  ,movement_date date ,movement_type varchar(30));
alter table order_movements add order_id int;

alter table order_movements add constraint fk_ordermv_order_id foreign key (order_id) references orders(order_id);
alter table order_movements add from_location_id int;
alter table order_movements add constraint fk_from_location_id foreign key (from_location_id) references inventory_locations(location_id);
alter table order_movements add to_location_id int;
alter table order_movements add constraint fk_to_location_id foreign key (to_location_id) references inventory_locations(location_id);



alter table order_movements add movement_status varchar(30);

create table partners(
partner_id int primary key auto_increment,
partner_name varchar(50),
partner_type enum('company','driver','supplier','customer'));
alter table inventory_locations add partner_id int;
alter table inventory_locations
add constraint fk_location_partner
foreign key (partner_id) references partners(partner_id);
-- shipment
-- shipment_id
-- sender_partner_id
-- receiver_partner_id
-- shipment_date 
create table shipments(shippment_id int primary key ,shippment_date date);
alter table shipments add column sender_partner_id int ,add constraint fk_shippment_sender foreign key (sender_partner_id) references partners(partner_id);
alter table shipments add column receiver_partner_id int ,add constraint fk_shippment_reciver foreign key (receiver_partner_id) references partners(partner_id);

alter table orders add shipment_id int,add constraint fk_orders_shipment foreign key (shipment_id) references shipments(shippment_id);

-- in orders
-- merchant_partner_id     -- company that created the order
-- assigned_driver_id      -- holds a partner_id; drivers are partners
ALTER TABLE orders add column merchant_partner_id int,
ADD CONSTRAINT fk_orders_merchant
FOREIGN KEY (merchant_partner_id)
REFERENCES partners(partner_id);

-- assigned_driver_id holds a partner_id (drivers are partners in this app).
-- The legacy `drivers` table is unused; no FK is enforced here.
ALTER TABLE orders add column assigned_driver_id int;

ALTER TABLE orders ADD CONSTRAINT fk_orders_company
  FOREIGN KEY (company_partner_id) REFERENCES partners(partner_id);

-- commissions
CREATE TABLE commissions (
    commission_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    partner_id INT,
    commission_type ENUM('incoming','outgoing'),
    amount DOUBLE,
    
    CONSTRAINT fk_commission_order
    FOREIGN KEY (order_id)
    REFERENCES orders(order_id),
    
    CONSTRAINT fk_commission_partner
    FOREIGN KEY (partner_id)
    REFERENCES partners(partner_id)
);

 INSERT INTO city (city_name)
VALUES ('Baghdad');

INSERT INTO city (city_name)
VALUES ('Erbil');
INSERT INTO address (address_name, city_id)
VALUES ('Karrada', 1);

INSERT INTO address (address_name, city_id)
VALUES ('Ankawa', 2);
INSERT INTO orders (receiptnum, phone, second_phone, retrieve, notes, address_id)
VALUES (1001, '0770000000', '0780000000', TRUE, 'Fragile', 1);

INSERT INTO orders (receiptnum, phone, second_phone, retrieve, notes, address_id)
VALUES (1002, '0750000000', NULL, FALSE, 'Handle carefully', 2);

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','merchant','driver') NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- double-entry accounting tables
CREATE TABLE accounts (
  account_id INT AUTO_INCREMENT PRIMARY KEY,
  account_name VARCHAR(60) NOT NULL,
  account_type ENUM('cash','AR','AP','expense','revenue') NOT NULL,
  partner_id INT NULL,
  UNIQUE KEY uniq_account_type_partner (account_type, partner_id),
  CONSTRAINT fk_accounts_partner FOREIGN KEY (partner_id) REFERENCES partners(partner_id)
);

CREATE TABLE transactions (
  transaction_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  description VARCHAR(255),
  order_id INT NULL,
  is_reversal TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_transactions_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);

CREATE TABLE transaction_lines (
  transaction_line_id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  account_id INT NOT NULL,
  debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_lines_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
  CONSTRAINT fk_lines_account FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE payment (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  amount DECIMAL(12,2) NOT NULL,
  payment_type ENUM('incoming','outgoing') NOT NULL,
  partner_id INT NULL,
  order_id INT NULL,
  transaction_id INT NULL,
  payment_notes VARCHAR(255),
  CONSTRAINT fk_payment_partner FOREIGN KEY (partner_id) REFERENCES partners(partner_id),
  CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE SET NULL
);

INSERT INTO accounts (account_name, account_type) VALUES
  ('Cash', 'cash'),
  ('Accounts Receivable - Customers', 'AR'),
  ('Delivery Revenue', 'revenue'),
  ('Delivery Expense', 'expense');

