export interface ChannelRequest {
    name: string;
    logo?: string;
    history?: string;
    startDate: string;
    endDate?: string;
}

export interface ChannelResponse {
    id: number;
    name: string;
    logoPath: string;
    history?: string;
    startDate: string;
    endDate?: string;
    seriesIds: number[];
}

export interface AssignSeriesRequest {
    seriesIds: number[];
}
