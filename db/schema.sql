CREATE DATABASE IF NOT EXISTS vitoria_regia
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE vitoria_regia;

CREATE TABLE IF NOT EXISTS parcels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    resident VARCHAR(140) NOT NULL,
    building CHAR(1) NOT NULL,
    apartment VARCHAR(12) NOT NULL,
    carrier VARCHAR(100) NOT NULL DEFAULT 'Não informado',
    porter VARCHAR(140) NOT NULL,
    notes TEXT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    picked_up_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    CONSTRAINT parcels_building_check CHECK (building IN ('A', 'B', 'C')),
    CONSTRAINT parcels_status_check CHECK (status IN ('pending', 'picked_up')),
    CONSTRAINT parcels_pickup_consistency_check CHECK (
        (status = 'pending' AND picked_up_at IS NULL)
        OR (status = 'picked_up' AND picked_up_at IS NOT NULL)
    ),
    KEY parcels_received_at_idx (received_at),
    KEY parcels_status_idx (status),
    KEY parcels_resident_idx (resident)
) ENGINE=InnoDB
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'vitoria_app'@'127.0.0.1'
    IDENTIFIED BY '24432298';
CREATE USER IF NOT EXISTS 'vitoria_app'@'localhost'
    IDENTIFIED BY '24432298';

ALTER USER 'vitoria_app'@'127.0.0.1' IDENTIFIED BY '24432298';
ALTER USER 'vitoria_app'@'localhost' IDENTIFIED BY '24432298';

GRANT SELECT, INSERT, UPDATE ON vitoria_regia.*
    TO 'vitoria_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE ON vitoria_regia.*
    TO 'vitoria_app'@'localhost';

  CREATE USER IF NOT EXISTS 'vitoria_app'@'127.0.0.1'
IDENTIFIED BY '24432298';

ALTER USER 'vitoria_app'@'127.0.0.1'
IDENTIFIED BY '24432298';
  
  