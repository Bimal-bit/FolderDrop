# Stage 1: Build the React web UI.
FROM node:20-alpine AS web-build

WORKDIR /web-ui

# Render uses the repository root as the Docker build context.
COPY web-ui/package.json web-ui/package-lock.json* ./
RUN npm ci

COPY web-ui/ ./
RUN npm run build

# Stage 2: Build the Spring Boot JAR.
FROM eclipse-temurin:21-jdk-alpine AS java-build

WORKDIR /app

COPY backend/pom.xml .
COPY backend/.mvn/ .mvn/
COPY backend/mvnw* ./
RUN chmod +x mvnw

RUN ./mvnw dependency:go-offline -B -q

COPY backend/src/ src/
COPY --from=web-build /web-ui/dist/ src/main/resources/static/

RUN ./mvnw package -DskipTests -B -q

# Stage 3: Runtime image.
FROM eclipse-temurin:21-jre-alpine AS runtime

RUN addgroup -S folderdrop && adduser -S folderdrop -G folderdrop

WORKDIR /app

COPY --from=java-build /app/target/folderdrop-server-*.jar app.jar
RUN chown folderdrop:folderdrop app.jar

USER folderdrop

# Locally the app defaults to 8080. On Render it binds to PORT, usually 10000.
EXPOSE 8080 10000

ENV JAVA_OPTS="-Xmx180m -Xms64m -XX:+UseContainerSupport -XX:MaxRAMPercentage=70.0 -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
