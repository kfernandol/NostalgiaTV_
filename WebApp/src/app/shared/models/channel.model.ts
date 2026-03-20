export interface ChannelRequest {
    name: string;
    isRandom: boolean;
}

export interface ChannelResponse {
    id: number;
    name: string;
    isRandom: boolean;
    seriesIds: number[];
}

export interface AssignSeriesRequest {
    seriesIds: number[];
}
