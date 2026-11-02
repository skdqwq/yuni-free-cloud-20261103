FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml ./
COPY com ./com
COPY resources ./resources
RUN mvn -B -DskipTests package
FROM eclipse-temurin:21-jre-jammy AS java
FROM node:22-bookworm-slim
COPY --from=java /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:$PATH"
WORKDIR /app
COPY --from=build --chown=node:node /src/target/yuni-backend-0.2.0.jar ./yuni.jar
COPY --chown=node:node proxy.cjs start.cjs ./
COPY --chown=node:node web ./web
COPY --chown=node:node tools ./tools
USER node
ENV HOST=0.0.0.0 PORT=10000 SPRING_PROFILES_ACTIVE=cloud YUNI_GATEWAY_URL=""
EXPOSE 10000
CMD ["node", "start.cjs"]
