package com.ifarmer.survey;

import io.github.cdimascio.dotenv.Dotenv;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.File;
import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;

@SpringBootApplication
public class SurveyEngineApplication {

    private static final Logger log = LoggerFactory.getLogger(SurveyEngineApplication.class);

    public static void main(String[] args) {
        loadEnvironmentVariables();
        SpringApplication.run(SurveyEngineApplication.class, args);
    }

    private static void loadEnvironmentVariables() {
        // Search locations for .env files
        String[] locations = {
                "./",
                "../server/",
                "../",
                "server-spring/"
        };

        for (String loc : locations) {
            try {
                File f = new File(loc, ".env");
                if (f.exists()) {
                    log.info("Loading environment configuration from: {}", f.getAbsolutePath());
                    Dotenv dotenv = Dotenv.configure()
                            .directory(loc)
                            .ignoreIfMalformed()
                            .ignoreIfMissing()
                            .load();

                    dotenv.entries().forEach(entry -> {
                        if (System.getProperty(entry.getKey()) == null) {
                            System.setProperty(entry.getKey(), entry.getValue());
                        }
                    });
                    break;
                }
            } catch (Exception e) {
                // Continue searching next location
            }
        }

        // Configure Spring Datasource from DATABASE_URL or individual DB_* variables
        String databaseUrl = System.getProperty("DATABASE_URL", System.getenv("DATABASE_URL"));
        if (databaseUrl != null && !databaseUrl.isBlank()) {
            configureFromDatabaseUrl(databaseUrl);
        } else {
            configureFromDiscreteVariables();
        }

        // Verify connectivity to the configured datasource; fallback to embedded H2 if unreachable
        String url = System.getProperty("SPRING_DATASOURCE_URL");
        String user = System.getProperty("SPRING_DATASOURCE_USERNAME", "");
        String pass = System.getProperty("SPRING_DATASOURCE_PASSWORD", "");

        if (url != null && !isDatabaseReachable(url, user, pass)) {
            log.warn("⚠️ Configured PostgreSQL datasource is not reachable. Falling back to embedded local H2 database for offline mode.");
            File dataDir = new File("data");
            if (!dataDir.exists()) {
                dataDir.mkdirs();
            }
            System.setProperty("SPRING_DATASOURCE_URL", "jdbc:h2:file:./data/survey_engine;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1");
            System.setProperty("SPRING_DATASOURCE_DRIVER_CLASS_NAME", "org.h2.Driver");
            System.setProperty("SPRING_DATASOURCE_USERNAME", "sa");
            System.setProperty("SPRING_DATASOURCE_PASSWORD", "");
            System.setProperty("SPRING_JPA_DATABASE_PLATFORM", "org.hibernate.dialect.H2Dialect");
            log.info("🚀 Embedded H2 database configured at ./data/survey_engine");
        }
    }

    private static boolean isDatabaseReachable(String jdbcUrl, String username, String password) {
        if (!jdbcUrl.startsWith("jdbc:postgresql:")) {
            return true;
        }
        try {
            DriverManager.setLoginTimeout(3);
            try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {
                return true;
            }
        } catch (Exception e) {
            log.warn("Datasource connection probe failed: {}", e.getMessage());
            return false;
        }
    }

    private static void configureFromDatabaseUrl(String rawUrl) {
        try {
            // Normalize postgresql:// or postgres:// to http:// for java.net.URI parsing
            String parsable = rawUrl.replaceFirst("^(postgresql|postgres):", "http:");
            URI uri = URI.create(parsable);

            String userInfo = uri.getUserInfo();
            if (userInfo != null && userInfo.contains(":")) {
                String[] parts = userInfo.split(":", 2);
                System.setProperty("SPRING_DATASOURCE_USERNAME", parts[0]);
                System.setProperty("SPRING_DATASOURCE_PASSWORD", parts[1]);
            }

            int port = uri.getPort() != -1 ? uri.getPort() : 5432;
            String host = uri.getHost();
            String path = uri.getPath();

            StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                    .append(host)
                    .append(":")
                    .append(port)
                    .append(path);

            boolean isCloud = host != null && !host.equals("localhost") && !host.equals("127.0.0.1");
            String query = uri.getQuery();

            if (query != null && !query.isBlank()) {
                jdbcUrl.append("?").append(query);
            } else if (isCloud) {
                jdbcUrl.append("?sslmode=require");
            }

            log.info("Configured JDBC Datasource URL for host: {}:{}", host, port);
            System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl.toString());

        } catch (Exception e) {
            log.warn("Could not parse DATABASE_URL as URI, using fallback raw JDBC conversion: {}", e.getMessage());
            String jdbcUrl = rawUrl.startsWith("jdbc:") ? rawUrl : "jdbc:" + rawUrl;
            System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);
        }
    }

    private static void configureFromDiscreteVariables() {
        String host = System.getProperty("DB_HOST", System.getenv().getOrDefault("DB_HOST", "localhost"));
        String port = System.getProperty("DB_PORT", System.getenv().getOrDefault("DB_PORT", "5432"));
        String db = System.getProperty("DB_NAME", System.getenv().getOrDefault("DB_NAME", "survey_engine"));
        String user = System.getProperty("DB_USERNAME", System.getenv().getOrDefault("DB_USERNAME", "postgres"));
        String pass = System.getProperty("DB_PASSWORD", System.getenv().getOrDefault("DB_PASSWORD", "postgrespassword"));

        String jdbcUrl = "jdbc:postgresql://" + host + ":" + port + "/" + db;
        System.setProperty("SPRING_DATASOURCE_URL", jdbcUrl);
        System.setProperty("SPRING_DATASOURCE_USERNAME", user);
        System.setProperty("SPRING_DATASOURCE_PASSWORD", pass);
    }
}

