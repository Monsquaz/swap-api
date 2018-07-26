CREATE TABLE files (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) UNIQUE,
  sizeBytes INT
);

CREATE TABLE users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  firstname VARCHAR(100) NOT NULL,
  lastname VARCHAR(100) NOT NULL,
  password VARCHAR(128) NOT NULL,
  activation_status TINYINT(4) NOT NULL,
  activation_code VARCHAR(128) NOT NULL
);

CREATE TABLE rounds (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  `index` INT NOT NULL
);

CREATE TABLE roundsubmissions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  round_id INT NOT NULL,
  song_id INT NOT NULL,
  status ENUM(
           'Planned',
           'Started',
           'FillInRequested',
           'FillinAquired',
           'Submitted',
           'Completed',
           'Skipped'
         ),
  participant INT,
  fill_in_participant INT,
  file_id_seeded INT,
  file_id_submitted INT,
  previous INT,
  next INT,
  event_id INT NOT NULL
);

ALTER TABLE roundsubmissions ADD FOREIGN KEY (previous) REFERENCES roundsubmissions (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE roundsubmissions ADD FOREIGN KEY (next) REFERENCES roundsubmissions (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE roundsubmissions ADD FOREIGN KEY (participant) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE roundsubmissions ADD FOREIGN KEY (fill_in_participant) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE roundsubmissions ADD FOREIGN KEY (file_id_seeded) REFERENCES files (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE roundsubmissions ADD FOREIGN KEY (file_id_submitted) REFERENCES files (id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE events (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created DATETIME NOT NULL,
  started DATETIME,
  completed DATETIME,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  created DATETIME NOT NULL,
  status ENUM(
           'Planned',
           'Started',
           'Completed'
         ) NOT NULL DEFAULT 'Planned',
  current_round INT,
  num_rounds INT,
  num_participants INT,
  host_user_id INT,
  are_changes_visible TINYINT(4) NOT NULL,
  is_schedule_visible TINYINT(4) NOT NULL,
  is_public TINYINT(4) NOT NULL,
  initial_file INT
);

ALTER TABLE events ADD FOREIGN KEY (initial_file) REFERENCES files (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE events ADD FOREIGN KEY (host_user_id) REFERENCES users (id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE `events` ADD FOREIGN KEY (`current_round`) REFERENCES `rounds` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE rounds ADD FOREIGN KEY (event_id) REFERENCES events (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE songs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL
);

ALTER TABLE songs ADD FOREIGN KEY (event_id) REFERENCES events (id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE event_participants (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  created DATETIME NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE);

CREATE TABLE event_invitations (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  created DATETIME NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events (id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE);
