CREATE DATABASE IF NOT EXISTS  shippingmgt;

USE shippingmgt;

create table orders (order_id int not null auto_increment primary key  , receiptnum int ,phone varchar(15), second_phone varchar(15)
,retrieve boolean,notes varchar(90));


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
create table accounts(account_id int primary key ,account_name varchar(30),account_type ENUM("cash","AR","AP","expence","revenue"));
create table transactions (transaction_id int primary key,transaction_date date, description varchar(30));
create table transaction_lines(transaction_line_id int primary key , debit double,credit double);
alter table   transaction_lines add column accout_id int,add constraint fk_lines_account_id foreign key  (accout_id) references accounts(account_id);
alter table transaction_lines add column transaction_id int ,add constraint fk_transactionID_lines foreign key (transaction_id) references transactions(transaction_id);
create table payment (payment_id int primary key, payment_notes varchar(30),amout int);
alter table payment add column account_recivalbe_id int ,add constraint fk_recive_AR foreign key (account_recivalbe_id) references  orders(order_id);
alter table payment add column account_payable_id int ,add constraint fk_pay_AR foreign key (account_payable_id) references  orders(order_id);
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
CREATE TABLE drivers (
    driver_id INT AUTO_INCREMENT PRIMARY KEY,
    driver_name VARCHAR(50),
    phone VARCHAR(15)
);

-- in orders 
-- merchant_partner_id     -- company that created the order
-- assigned_driver_id 
ALTER TABLE orders add column merchant_partner_id int,
ADD CONSTRAINT fk_orders_merchant
FOREIGN KEY (merchant_partner_id)
REFERENCES partners(partner_id);

ALTER TABLE orders add column assigned_driver_id int,
ADD CONSTRAINT fk_orders_driver
FOREIGN KEY (assigned_driver_id)
REFERENCES drivers(driver_id);

-- alter accounts to have parter_id 
-- commissions
ALTER TABLE accounts
ADD partner_id INT;

ALTER TABLE accounts
ADD CONSTRAINT fk_accounts_partner
FOREIGN KEY (partner_id)
REFERENCES partners(partner_id);

-- commission_id
-- order_id
-- partner_id
-- commission_type
-- amount

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


