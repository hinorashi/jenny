FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod ./
COPY . ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/pokemon-api .

FROM alpine:3.22
RUN addgroup -S app && adduser -S -G app app
COPY --from=build /out/pokemon-api /usr/local/bin/pokemon-api
USER app
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/pokemon-api"]
