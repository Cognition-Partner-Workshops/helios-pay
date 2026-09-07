FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN go build -o /out/ledger-worker ./cmd

FROM alpine:3.20
RUN apk add --no-cache wget
COPY --from=build /out/ledger-worker /usr/local/bin/ledger-worker
EXPOSE 8090
CMD ["ledger-worker"]
